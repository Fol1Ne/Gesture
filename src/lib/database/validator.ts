import type { RecognitionCandidate, VisionFrame } from "@/types";
import { findAslEntry, type LandmarkChannel } from "./schema";

export interface ValidationResult {
  candidate: RecognitionCandidate;
  score: number;
  accepted: boolean;
}

function hasChannel(frame: VisionFrame | undefined, channel: LandmarkChannel): boolean {
  if (!frame) return false;
  if (channel === "face") return !!frame.face?.landmarks.length;
  if (channel === "pose") return !!frame.pose?.landmarks.length;
  if (channel === "leftHand") return frame.hands.some((hand) => hand.handedness === "Left");
  return frame.hands.some((hand) => hand.handedness === "Right");
}

function channelCoverage(window: readonly VisionFrame[], channel: LandmarkChannel): number {
  if (window.length === 0) return 0;
  const present = window.filter((frame) => hasChannel(frame, channel)).length;
  return present / window.length;
}

function motionCoverage(window: readonly VisionFrame[]): number {
  if (window.length < 2) return 0;
  const first = window[0].hands[0]?.landmarks[0];
  const last = window[window.length - 1].hands[0]?.landmarks[0];
  if (!first || !last) return 0;

  const displacement = Math.hypot(last.x - first.x, last.y - first.y, last.z - first.z);
  return Math.min(1, displacement / 0.08);
}

export function validateCandidate(
  candidate: RecognitionCandidate,
  window: readonly VisionFrame[]
): ValidationResult {
  const entry = findAslEntry(candidate.label);

  if (!entry) {
    return {
      candidate: { ...candidate, databaseScore: candidate.confidence * 0.7 },
      score: candidate.confidence * 0.7,
      accepted: candidate.kind === "letter",
    };
  }

  const requiredCoverage =
    entry.requiredChannels.reduce((sum, channel) => sum + channelCoverage(window, channel), 0) /
    Math.max(1, entry.requiredChannels.length);

  const facialScore =
    entry.requiredFacialFeatures.length === 0 ? 1 : channelCoverage(window, "face");
  const motionScore = motionCoverage(window);
  const landmarkScore = requiredCoverage * 0.5 + facialScore * 0.2 + motionScore * 0.3;
  const score = Math.min(1, candidate.confidence * 0.55 + landmarkScore * 0.45);

  return {
    candidate: { ...candidate, databaseScore: score },
    score,
    accepted: score >= entry.confidenceThreshold * 0.85,
  };
}
