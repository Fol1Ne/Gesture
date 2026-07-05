// Thin wrapper around @mediapipe/tasks-vision.
//
// This is the ONLY file that should import @mediapipe/tasks-vision directly.
// Everything downstream (recognizer, buffer, UI) talks to our own
// VisionFrame type, so the underlying holistic detector stack can be swapped
// without touching the rest of the app.

import {
  FaceLandmarker,
  FilesetResolver,
  HandLandmarker,
  PoseLandmarker,
  type FaceLandmarkerResult,
  type HandLandmarkerResult,
  type PoseLandmarkerResult,
} from "@mediapipe/tasks-vision";
import type { FaceFrame, HandFrame, PoseFrame, VisionFrame } from "@/types";

const WASM_BASE =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";

const HAND_MODEL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

const POSE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task";

const FACE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task";

let handLandmarker: HandLandmarker | null = null;
let poseLandmarker: PoseLandmarker | null = null;
let faceLandmarker: FaceLandmarker | null = null;
let initPromise: Promise<void> | null = null;

export interface VisionEngineOptions {
  numHands?: number;
  onProgress?: (message: string) => void;
}

/** Loads the WASM runtime plus hand, pose, and face models. Safe to call repeatedly. */
export async function initVisionEngine(
  opts: VisionEngineOptions = {}
): Promise<void> {
  if (handLandmarker && poseLandmarker && faceLandmarker) return;
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
      minPoseDetectionConfidence: 0.35,
      minPosePresenceConfidence: 0.35,
      minTrackingConfidence: 0.35,
    });

    opts.onProgress?.("Loading face landmark model...");
    faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: FACE_MODEL, delegate: "GPU" },
      runningMode: "VIDEO",
      numFaces: 1,
      minFaceDetectionConfidence: 0.5,
      minFacePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    opts.onProgress?.("Ready.");
  })();

  return initPromise;
}

export function isVisionEngineReady(): boolean {
  return !!handLandmarker && !!poseLandmarker && !!faceLandmarker;
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

function toFaceFrame(result: FaceLandmarkerResult): FaceFrame | null {
  if (!result.faceLandmarks.length) return null;
  return {
    landmarks: result.faceLandmarks[0].map((p) => ({ x: p.x, y: p.y, z: p.z })),
  };
}

/**
 * Runs the full landmark detector stack against a single video frame.
 * `video` must already have a fresh frame decoded (readyState >= 2).
 */
export function detectFrame(
  video: HTMLVideoElement,
  timestampMs: number
): VisionFrame | null {
  if (!handLandmarker || !poseLandmarker || !faceLandmarker) return null;
  if (video.readyState < 2) return null;

  const handResult = handLandmarker.detectForVideo(video, timestampMs);
  const poseResult = poseLandmarker.detectForVideo(video, timestampMs);
  const faceResult = faceLandmarker.detectForVideo(video, timestampMs);

  return {
    timestampMs,
    hands: toHandFrames(handResult),
    pose: toPoseFrame(poseResult),
    face: toFaceFrame(faceResult),
  };
}

export function disposeVisionEngine() {
  handLandmarker?.close();
  poseLandmarker?.close();
  faceLandmarker?.close();
  handLandmarker = null;
  poseLandmarker = null;
  faceLandmarker = null;
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
  [0, 1], [1, 2], [2, 3], [3, 7], // left eye/ear contour
  [0, 4], [4, 5], [5, 6], [6, 8], // right eye/ear contour
  [9, 10], // mouth
  [11, 12], // shoulders
  [11, 13], [13, 15], // left arm
  [12, 14], [14, 16], // right arm
  [15, 17], [17, 19], [19, 21], [15, 19], // left hand anchor
  [16, 18], [18, 20], [20, 22], [16, 20], // right hand anchor
  [11, 23], [12, 24], [23, 24], // torso
  [23, 25], [25, 27], [27, 29], [29, 31], [27, 31], // left leg/foot
  [24, 26], [26, 28], [28, 30], [30, 32], [28, 32], // right leg/foot
];

// Sparse face mesh connections focused on demo readability: contours, eyes,
// brows, nose, and lips from MediaPipe's 468-point topology.
export const FACE_CONNECTIONS: [number, number][] = [
  [10, 338], [338, 297], [297, 332], [332, 284], [284, 251], [251, 389],
  [389, 356], [356, 454], [454, 323], [323, 361], [361, 288], [288, 397],
  [397, 365], [365, 379], [379, 378], [378, 400], [400, 377], [377, 152],
  [152, 148], [148, 176], [176, 149], [149, 150], [150, 136], [136, 172],
  [172, 58], [58, 132], [132, 93], [93, 234], [234, 127], [127, 162],
  [162, 21], [21, 54], [54, 103], [103, 67], [67, 109], [109, 10],
  [33, 246], [246, 161], [161, 160], [160, 159], [159, 158], [158, 157],
  [157, 173], [173, 133], [133, 155], [155, 154], [154, 153], [153, 145],
  [145, 144], [144, 163], [163, 7], [7, 33],
  [362, 398], [398, 384], [384, 385], [385, 386], [386, 387], [387, 388],
  [388, 466], [466, 263], [263, 249], [249, 390], [390, 373], [373, 374],
  [374, 380], [380, 381], [381, 382], [382, 362],
  [70, 63], [63, 105], [105, 66], [66, 107],
  [336, 296], [296, 334], [334, 293], [293, 300],
  [1, 2], [2, 98], [2, 327], [98, 97], [327, 326],
  [61, 185], [185, 40], [40, 39], [39, 37], [37, 0], [0, 267],
  [267, 269], [269, 270], [270, 409], [409, 291], [291, 375], [375, 321],
  [321, 405], [405, 314], [314, 17], [17, 84], [84, 181], [181, 91],
  [91, 146], [146, 61],
];
