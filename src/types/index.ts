// Core shared types for the ASL Live Translator pipeline.
// Keeping these centralized makes it possible to swap the recognition
// engine (rule-based demo -> WLASL/How2Sign model) without touching
// consumers of the data.

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

/** A single hand's 21 MediaPipe landmarks, plus derived metadata. */
export interface HandFrame {
  handedness: "Left" | "Right";
  landmarks: Point3D[]; // 21 points, normalized [0,1] image space
  worldLandmarks: Point3D[]; // metric-scale, wrist-relative
}

/** A single pose's landmarks (subset we care about: shoulders, elbows, wrists). */
export interface PoseFrame {
  landmarks: Point3D[];
}

/** MediaPipe face mesh frame: 468 normalized facial landmarks. */
export interface FaceFrame {
  landmarks: Point3D[];
}

/** One sampled instant of the input stream, after MediaPipe inference. */
export interface VisionFrame {
  timestampMs: number;
  hands: HandFrame[];
  pose: PoseFrame | null;
  face: FaceFrame | null;
}

/** Result emitted by the recognition engine for a single frame or window. */
export interface RecognitionCandidate {
  label: string; // e.g. "HELLO", or a single letter "H" for fingerspelling
  confidence: number; // 0..1
  kind: "word" | "letter";
  databaseScore?: number; // 0..1 similarity score from the internal ASL database
  cooldownMs?: number;
}

/** A word/letter that has survived temporal smoothing and been committed. */
export interface CommittedToken {
  id: string;
  label: string;
  kind: "word" | "letter";
  confidence: number;
  committedAt: number;
}

export interface TranscriptEntry {
  id: string;
  text: string;
  createdAt: number;
}

export type InputSource = "webcam" | "screen";

export interface RecognizerEngineInfo {
  name: string;
  vocabulary: string[];
  isPretrained: boolean;
}

export interface TrackingState {
  face: boolean;
  pose: boolean;
  leftHand: boolean;
  rightHand: boolean;
}

export interface RecognitionDebugMetrics {
  tracking: TrackingState;
  recognitionStatus: "idle" | "running" | "validating" | "stabilizing";
  frameBufferSize: number;
  databaseMatch: number;
  landmarkCount: number;
  faceLandmarkCount: number;
  poseLandmarkCount: number;
  leftHandLandmarkCount: number;
  rightHandLandmarkCount: number;
  totalSigns: number;
  signsWithSamples: number;
  requiredSamplesPerSign: number;
}

export interface AppSettings {
  voiceEnabled: boolean;
  voiceId: string;
  elevenLabsApiKey: string;
  confidenceThreshold: number; // 0..1, min confidence to consider a candidate
  stableFramesRequired: number; // frames needed before committing a word
  overlayMode: boolean;
  pipMode: boolean;
  darkMode: boolean;
  inputSource: InputSource;
}
