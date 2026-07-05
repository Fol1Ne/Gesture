// Thin wrapper around @mediapipe/tasks-vision.
//
// This is the ONLY file that should import @mediapipe/tasks-vision directly.
// Everything downstream (recognizer, buffer, UI) talks to our own
// VisionFrame type, so the underlying hand/pose detector can be swapped
// without touching the rest of the app.

import {
  FilesetResolver,
  HandLandmarker,
  PoseLandmarker,
  type HandLandmarkerResult,
  type PoseLandmarkerResult,
} from "@mediapipe/tasks-vision";
import type { HandFrame, PoseFrame, VisionFrame } from "@/types";

const WASM_BASE =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";

const HAND_MODEL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

const POSE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

let handLandmarker: HandLandmarker | null = null;
let poseLandmarker: PoseLandmarker | null = null;
let initPromise: Promise<void> | null = null;

export interface VisionEngineOptions {
  numHands?: number;
  onProgress?: (message: string) => void;
}

/** Loads the WASM runtime + both models. Safe to call multiple times. */
export async function initVisionEngine(
  opts: VisionEngineOptions = {}
): Promise<void> {
  if (handLandmarker && poseLandmarker) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    opts.onProgress?.("Loading MediaPipe runtime...");
    const vision = await FilesetResolver.forVisionTasks(WASM_BASE);

    opts.onProgress?.("Loading hand landmark model...");
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: HAND_MODEL, delegate: "GPU" },
      runningMode: "VIDEO",
      numHands: opts.numHands ?? 2,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    opts.onProgress?.("Loading pose landmark model...");
    poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: POSE_MODEL, delegate: "GPU" },
      runningMode: "VIDEO",
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    opts.onProgress?.("Ready.");
  })();

  return initPromise;
}

export function isVisionEngineReady(): boolean {
  return !!handLandmarker && !!poseLandmarker;
}

function toHandFrames(result: HandLandmarkerResult): HandFrame[] {
  const frames: HandFrame[] = [];
  for (let i = 0; i < result.landmarks.length; i++) {
    const handedness = result.handedness[i]?.[0]?.categoryName === "Left"
      ? "Left"
      : "Right";
    frames.push({
      handedness,
      landmarks: result.landmarks[i].map((p) => ({ x: p.x, y: p.y, z: p.z })),
      worldLandmarks: (result.worldLandmarks[i] ?? []).map((p) => ({
        x: p.x,
        y: p.y,
        z: p.z,
      })),
    });
  }
  return frames;
}

function toPoseFrame(result: PoseLandmarkerResult): PoseFrame | null {
  if (!result.landmarks.length) return null;
  return {
    landmarks: result.landmarks[0].map((p) => ({ x: p.x, y: p.y, z: p.z })),
  };
}

/**
 * Runs both detectors against a single video frame.
 * `video` must already have a fresh frame decoded (readyState >= 2).
 */
export function detectFrame(
  video: HTMLVideoElement,
  timestampMs: number
): VisionFrame | null {
  if (!handLandmarker || !poseLandmarker) return null;
  if (video.readyState < 2) return null;

  const handResult = handLandmarker.detectForVideo(video, timestampMs);
  const poseResult = poseLandmarker.detectForVideo(video, timestampMs);

  return {
    timestampMs,
    hands: toHandFrames(handResult),
    pose: toPoseFrame(poseResult),
  };
}

export function disposeVisionEngine() {
  handLandmarker?.close();
  poseLandmarker?.close();
  handLandmarker = null;
  poseLandmarker = null;
  initPromise = null;
}

// Hand landmark connections for drawing the skeleton wireframe (indices
// per MediaPipe's 21-point hand model).
export const HAND_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], // thumb
  [0, 5], [5, 6], [6, 7], [7, 8], // index
  [5, 9], [9, 10], [10, 11], [11, 12], // middle
  [9, 13], [13, 14], [14, 15], [15, 16], // ring
  [13, 17], [17, 18], [18, 19], [19, 20], // pinky
  [0, 17], // palm base
];

export const POSE_CONNECTIONS: [number, number][] = [
  [11, 12], // shoulders
  [11, 13], [13, 15], // left arm
  [12, 14], [14, 16], // right arm
];
