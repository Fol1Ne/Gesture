"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  FACE_CONNECTIONS,
  HAND_CONNECTIONS,
  POSE_CONNECTIONS,
  detectFrame,
  disposeVisionEngine,
  initVisionEngine,
  isVisionEngineReady,
} from "@/lib/vision/mediapipe";
import { FrameBuffer, StabilityVoter } from "@/lib/vision/buffer";
import {
  demoRecognizer,
  fingerspellRecognizer,
  templateRecognizer,
} from "@/lib/vision/recognizer";
import { validateCandidate } from "@/lib/database/validator";
import {
  appendRecognizedWord,
  createSentenceState,
  finalizeSentence,
  renderSentence,
} from "@/lib/recognition/sentenceBuilder";
import { FingerSpellingBuffer } from "@/lib/recognition/fingerSpelling";
import { PredictionStabilizer } from "@/lib/recognition/stabilizer";
import { useAppStore } from "@/store/useAppStore";
import { recognizePersonalSign } from "@/lib/vocabulary/recognizer";
import type { InputSource, RecognitionCandidate, VisionFrame } from "@/types";

// Pause-to-finalize: if no new word is committed for this long, the
// in-progress sentence is finalized into the transcript.
const SENTENCE_TIMEOUT_MS = 2500;

function landmarkCount(frame: VisionFrame | null): number {
  if (!frame) return 0;
  return (
    (frame.face?.landmarks.length ?? 0) +
    (frame.pose?.landmarks.length ?? 0) +
    frame.hands.reduce((sum, hand) => sum + hand.landmarks.length, 0)
  );
}

function landmarkCounts(frame: VisionFrame | null) {
  const leftHand = frame?.hands.find((hand) => hand.handedness === "Left");
  const rightHand = frame?.hands.find((hand) => hand.handedness === "Right");

  return {
    faceLandmarkCount: frame?.face?.landmarks.length ?? 0,
    poseLandmarkCount: frame?.pose?.landmarks.length ?? 0,
    leftHandLandmarkCount: leftHand?.landmarks.length ?? 0,
    rightHandLandmarkCount: rightHand?.landmarks.length ?? 0,
  };
}

function trackingState(frame: VisionFrame | null) {
  return {
    face: !!frame?.face?.landmarks.length,
    pose: !!frame?.pose?.landmarks.length,
    leftHand: !!frame?.hands.some((hand) => hand.handedness === "Left"),
    rightHand: !!frame?.hands.some((hand) => hand.handedness === "Right"),
  };
}

function drawSkeleton(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  frame: ReturnType<typeof detectFrame>
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!frame) return;

  const w = canvas.width;
  const h = canvas.height;

  if (frame.face) {
    ctx.strokeStyle = "rgba(88, 166, 255, 0.34)";
    ctx.lineWidth = 1;
    for (const [a, b] of FACE_CONNECTIONS) {
      const pa = frame.face.landmarks[a];
      const pb = frame.face.landmarks[b];
      if (!pa || !pb) continue;
      ctx.beginPath();
      ctx.moveTo(pa.x * w, pa.y * h);
      ctx.lineTo(pb.x * w, pb.y * h);
      ctx.stroke();
    }
  }

  if (frame.pose) {
    ctx.strokeStyle = "rgba(63, 185, 80, 0.58)";
    ctx.lineWidth = 3;
    for (const [a, b] of POSE_CONNECTIONS) {
      const pa = frame.pose.landmarks[a];
      const pb = frame.pose.landmarks[b];
      if (!pa || !pb) continue;
      ctx.beginPath();
      ctx.moveTo(pa.x * w, pa.y * h);
      ctx.lineTo(pb.x * w, pb.y * h);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(63, 185, 80, 0.9)";
    for (const p of frame.pose.landmarks) {
      ctx.beginPath();
      ctx.arc(p.x * w, p.y * h, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  for (const hand of frame.hands) {
    ctx.strokeStyle = hand.handedness === "Left" ? "#58A6FF" : "#3FB950";
    ctx.lineWidth = 2.5;
    for (const [a, b] of HAND_CONNECTIONS) {
      const pa = hand.landmarks[a];
      const pb = hand.landmarks[b];
      if (!pa || !pb) continue;
      ctx.beginPath();
      ctx.moveTo(pa.x * w, pa.y * h);
      ctx.lineTo(pb.x * w, pb.y * h);
      ctx.stroke();
    }
    ctx.fillStyle = "#F0F6FC";
    for (const p of hand.landmarks) {
      ctx.beginPath();
      ctx.arc(p.x * w, p.y * h, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export function useVisionEngine(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  canvasRef?: React.RefObject<HTMLCanvasElement | null>
) {
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const bufferRef = useRef(new FrameBuffer(60));
  const wordStabilizerRef = useRef(
    new PredictionStabilizer({ requiredFrames: 8, defaultCooldownMs: 1200 })
  );
  const letterVoterRef = useRef(new StabilityVoter(10));
  const fingerSpellingRef = useRef(new FingerSpellingBuffer());
  const cleanupStateRef = useRef(createSentenceState());
  const lastCommitAtRef = useRef<number>(0);
  const fpsCounterRef = useRef({ frames: 0, last: 0 });
  const tickRef = useRef<() => void>(() => {});

  const store = useAppStore;

  const applyValidatedReadout = useCallback(
    (
      candidate: RecognitionCandidate | null,
      window: readonly VisionFrame[],
      fps: number
    ) => {
      if (!candidate) {
        store.getState().setDebugMetrics({
          recognitionStatus: "running",
          databaseMatch: 0,
        });
        return null;
      }

      const validation = validateCandidate(candidate, window);
      store.getState().setDebugMetrics({
        recognitionStatus: validation.accepted ? "stabilizing" : "validating",
        databaseMatch: validation.score,
      });

      if (!validation.accepted) return null;

      store
        .getState()
        .setLiveReadout(validation.candidate.label, validation.candidate.confidence, fps);
      return validation.candidate;
    },
    [store]
  );

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    bufferRef.current.clear();
    wordStabilizerRef.current.reset();
    letterVoterRef.current.reset();
    fingerSpellingRef.current.reset();
    cleanupStateRef.current = createSentenceState();
    store.getState().setCameraStatus("idle");
    store.getState().setLiveReadout(null, 0, 0);
    store.getState().setDebugMetrics({
      tracking: { face: false, pose: false, leftHand: false, rightHand: false },
      recognitionStatus: "idle",
      frameBufferSize: 0,
      databaseMatch: 0,
      landmarkCount: 0,
      faceLandmarkCount: 0,
      poseLandmarkCount: 0,
      leftHandLandmarkCount: 0,
      rightHandLandmarkCount: 0,
    });
  }, [store, videoRef]);

  const captureRecentFrames = useCallback(() => {
    return [...bufferRef.current.get()];
  }, []);

  const tick = useCallback(() => {
    const video = videoRef.current;
    if (!video || !isVisionEngineReady()) {
      rafRef.current = requestAnimationFrame(() => tickRef.current());
      return;
    }

    const now = performance.now();
    const frame = detectFrame(video, now);
    const currentFps = store.getState().fps;

    // FPS tracking
    const fc = fpsCounterRef.current;
    fc.frames++;
    if (now - fc.last >= 500) {
      const fps = Math.round((fc.frames * 1000) / (now - fc.last));
      fc.frames = 0;
      fc.last = now;
      store.getState().setLiveReadout(
        store.getState().currentSign,
        store.getState().currentConfidence,
        fps
      );
    }

    if (canvasRef?.current) {
      drawSkeleton(canvasRef.current, video, frame);
    }

    if (frame) {
      bufferRef.current.push(frame);
      const { settings } = store.getState();
      const window = bufferRef.current.get();
      const displayFps = store.getState().fps || currentFps;

      store.getState().setDebugMetrics({
        tracking: trackingState(frame),
        recognitionStatus: "running",
        frameBufferSize: window.length,
        landmarkCount: landmarkCount(frame),
        ...landmarkCounts(frame),
      });

      if (frame.hands.length > 0) {
        const personalCandidate = recognizePersonalSign(window, store.getState().personalSigns);
        const wordCandidate =
          personalCandidate && personalCandidate.confidence >= settings.confidenceThreshold
            ? personalCandidate
            : templateRecognizer.classify(window) ?? demoRecognizer.classify(window);
        const thresholdCandidate =
          wordCandidate && wordCandidate.confidence >= settings.confidenceThreshold
            ? wordCandidate
            : null;
        const passesThreshold =
          thresholdCandidate && personalCandidate === thresholdCandidate
            ? thresholdCandidate
            : applyValidatedReadout(thresholdCandidate, window, displayFps);

        if (thresholdCandidate && personalCandidate === thresholdCandidate) {
          store.getState().setDebugMetrics({
            recognitionStatus: "stabilizing",
            databaseMatch: thresholdCandidate.databaseScore ?? thresholdCandidate.confidence,
          });
          store
            .getState()
            .setLiveReadout(thresholdCandidate.label, thresholdCandidate.confidence, displayFps);
        }

        wordStabilizerRef.current.setRequiredFrames(settings.stableFramesRequired);
        const committedWord = wordStabilizerRef.current.observe(passesThreshold);

        if (committedWord) {
          cleanupStateRef.current = appendRecognizedWord(cleanupStateRef.current, committedWord.label);
          store.getState().setActiveSentence(renderSentence(cleanupStateRef.current));
          lastCommitAtRef.current = Date.now();
        } else if (!passesThreshold) {
          // Try fingerspelling only when no word-level sign is confidently seen.
          const letterCandidate = fingerspellRecognizer.classify(window);
          const letterCandidateOverThreshold =
            letterCandidate && letterCandidate.confidence >= settings.confidenceThreshold
              ? letterCandidate
              : null;
          const letterOk = applyValidatedReadout(
            letterCandidateOverThreshold,
            window,
            displayFps
          );
          const committedLetter = letterVoterRef.current.observe(
            letterOk ? { label: letterOk.label, confidence: letterOk.confidence } : null
          );
          const spelledWord = fingerSpellingRef.current.observe(committedLetter);
          if (committedLetter) {
            lastCommitAtRef.current = Date.now();
          }
          if (spelledWord) {
            cleanupStateRef.current = appendRecognizedWord(cleanupStateRef.current, spelledWord);
            store.getState().setActiveSentence(renderSentence(cleanupStateRef.current));
          }
        }
      } else {
        wordStabilizerRef.current.observe(null);
        const spelledWord = fingerSpellingRef.current.observe(null);
        if (spelledWord) {
          cleanupStateRef.current = appendRecognizedWord(cleanupStateRef.current, spelledWord);
          store.getState().setActiveSentence(renderSentence(cleanupStateRef.current));
        }
        store.getState().setDebugMetrics({
          recognitionStatus: "running",
          databaseMatch: 0,
        });
      }
    } else {
      store.getState().setDebugMetrics({
        recognitionStatus: "running",
        frameBufferSize: bufferRef.current.length,
        landmarkCount: 0,
        faceLandmarkCount: 0,
        poseLandmarkCount: 0,
        leftHandLandmarkCount: 0,
        rightHandLandmarkCount: 0,
      });
    }

    // Auto-finalize sentence after a pause in signing.
    if (
      cleanupStateRef.current.words.length > 0 &&
      Date.now() - lastCommitAtRef.current > SENTENCE_TIMEOUT_MS
    ) {
      const { sentence, next } = finalizeSentence(cleanupStateRef.current);
      cleanupStateRef.current = next;
      if (sentence) store.getState().commitSentence(sentence);
    }

    rafRef.current = requestAnimationFrame(() => tickRef.current());
  }, [store, videoRef, canvasRef, applyValidatedReadout]);

  useEffect(() => {
    tickRef.current = tick;
  }, [tick]);

  const start = useCallback(
    async (source: InputSource) => {
      const { setCameraStatus, setLoadingMessage, setError } = store.getState();
      try {
        setError(null);
        setCameraStatus("loading");
        setLoadingMessage("Starting vision engine...");

        await initVisionEngine({
          onProgress: (msg) => setLoadingMessage(msg),
        });

        setLoadingMessage(
          source === "webcam" ? "Requesting camera access..." : "Requesting screen access..."
        );

        const stream =
          source === "webcam"
            ? await navigator.mediaDevices.getUserMedia({
                video: { width: 1280, height: 720, facingMode: "user" },
                audio: false,
              })
            : await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: false,
              });

        streamRef.current = stream;

        const video = videoRef.current;
        if (!video) throw new Error("Video element not mounted.");
        video.srcObject = stream;
        await video.play();

        setCameraStatus("running");
        lastCommitAtRef.current = Date.now();
        fpsCounterRef.current = { frames: 0, last: performance.now() };
        rafRef.current = requestAnimationFrame(() => tickRef.current());
      } catch (err) {
        console.error(err);
        const message =
          err instanceof Error ? err.message : "Failed to start capture.";
        setError(message);
      }
    },
    [store, videoRef]
  );

  useEffect(() => {
    return () => {
      stop();
      disposeVisionEngine();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { start, stop, captureRecentFrames };
}
