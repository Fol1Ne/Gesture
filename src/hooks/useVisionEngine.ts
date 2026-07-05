"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  HAND_CONNECTIONS,
  POSE_CONNECTIONS,
  detectFrame,
  disposeVisionEngine,
  initVisionEngine,
  isVisionEngineReady,
} from "@/lib/vision/mediapipe";
import { FrameBuffer, StabilityVoter } from "@/lib/vision/buffer";
import { demoRecognizer, fingerspellRecognizer } from "@/lib/vision/recognizer";
import {
  appendWord,
  createCleanupState,
  finalizeSentence,
  renderSentence,
} from "@/lib/services/transcriptCleanup";
import { useAppStore } from "@/store/useAppStore";
import type { InputSource } from "@/types";

// Pause-to-finalize: if no new word is committed for this long, the
// in-progress sentence is finalized into the transcript.
const SENTENCE_TIMEOUT_MS = 2500;

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

  if (frame.pose) {
    ctx.strokeStyle = "rgba(37, 99, 235, 0.5)";
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
  }

  for (const hand of frame.hands) {
    ctx.strokeStyle = "#2563EB";
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
    ctx.fillStyle = "#111827";
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
  const voterRef = useRef(new StabilityVoter(8));
  const letterVoterRef = useRef(new StabilityVoter(10));
  const letterRunRef = useRef<string[]>([]);
  const cleanupStateRef = useRef(createCleanupState());
  const lastCommitAtRef = useRef<number>(0);
  const fpsCounterRef = useRef({ frames: 0, last: 0 });
  const tickRef = useRef<() => void>(() => {});

  const store = useAppStore;

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    bufferRef.current.clear();
    voterRef.current.reset();
    letterVoterRef.current.reset();
    letterRunRef.current = [];
    cleanupStateRef.current = createCleanupState();
    store.getState().setCameraStatus("idle");
    store.getState().setLiveReadout(null, 0, 0);
  }, [store, videoRef]);

  const tick = useCallback(() => {
    const video = videoRef.current;
    if (!video || !isVisionEngineReady()) {
      rafRef.current = requestAnimationFrame(() => tickRef.current());
      return;
    }

    const now = performance.now();
    const frame = detectFrame(video, now);

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

      if (frame.hands.length > 0) {
        const wordCandidate = demoRecognizer.classify(window);
        const passesThreshold =
          wordCandidate && wordCandidate.confidence >= settings.confidenceThreshold
            ? wordCandidate
            : null;

        voterRef.current.setRequiredFrames(settings.stableFramesRequired);
        const committedWord = voterRef.current.observe(
          passesThreshold ? { label: passesThreshold.label, confidence: passesThreshold.confidence } : null
        );

        if (passesThreshold) {
          store
            .getState()
            .setLiveReadout(passesThreshold.label, passesThreshold.confidence, fc.frames);
        }

        if (committedWord) {
          cleanupStateRef.current = appendWord(cleanupStateRef.current, committedWord);
          store.getState().setActiveSentence(renderSentence(cleanupStateRef.current));
          lastCommitAtRef.current = Date.now();
        } else if (!passesThreshold) {
          // Try fingerspelling only when no word-level sign is confidently seen.
          const letterCandidate = fingerspellRecognizer.classify(window);
          const letterOk =
            letterCandidate && letterCandidate.confidence >= settings.confidenceThreshold
              ? letterCandidate
              : null;
          const committedLetter = letterVoterRef.current.observe(
            letterOk ? { label: letterOk.label, confidence: letterOk.confidence } : null
          );
          if (letterOk) {
            store.getState().setLiveReadout(letterOk.label, letterOk.confidence, fc.frames);
          }
          if (committedLetter) {
            letterRunRef.current.push(committedLetter);
            lastCommitAtRef.current = Date.now();
          } else if (letterRunRef.current.length && !letterOk) {
            // Hand shape changed away from a letter — collapse the run into a word.
            const word = letterRunRef.current.join("");
            letterRunRef.current = [];
            cleanupStateRef.current = appendWord(cleanupStateRef.current, word);
            store.getState().setActiveSentence(renderSentence(cleanupStateRef.current));
          }
        }
      } else {
        voterRef.current.observe(null);
      }
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
  }, [store, videoRef, canvasRef]);

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

  return { start, stop };
}
