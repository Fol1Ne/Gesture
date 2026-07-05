import type { Point3D } from "@/types";
import type { MotionFrame } from "@/lib/vision/motion";

export interface SimilarityScores {
  landmarks: number;
  motion: number;
  face: number;
  pose: number;
  temporal: number;
  combined: number;
}

function pointDistance(a: Point3D, b: Point3D): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function sequenceSimilarity(a: readonly Point3D[], b: readonly Point3D[]): number {
  const length = Math.min(a.length, b.length);
  if (length === 0) return 0;
  let total = 0;
  for (let i = 0; i < length; i++) {
    total += pointDistance(a[i], b[i]);
  }
  return Math.max(0, 1 - total / length);
}

function motionSimilarity(a: readonly MotionFrame[], b: readonly MotionFrame[]): number {
  const length = Math.min(a.length, b.length);
  if (length === 0) return 0;
  let total = 0;
  for (let i = 0; i < length; i++) {
    total += Math.abs(a[i].speed - b[i].speed) + Math.abs(a[i].acceleration - b[i].acceleration);
  }
  return Math.max(0, 1 - total / length);
}

export function combineSimilarityScores(scores: Omit<SimilarityScores, "combined">): SimilarityScores {
  return {
    ...scores,
    combined:
      scores.landmarks * 0.3 +
      scores.motion * 0.25 +
      scores.face * 0.2 +
      scores.pose * 0.15 +
      scores.temporal * 0.1,
  };
}

export function compareFeatureSequences(features: {
  liveHands: Point3D[];
  templateHands: Point3D[];
  liveFace: Point3D[];
  templateFace: Point3D[];
  livePose: Point3D[];
  templatePose: Point3D[];
  liveMotion: MotionFrame[];
  templateMotion: MotionFrame[];
  temporalCoverage: number;
}): SimilarityScores {
  return combineSimilarityScores({
    landmarks: sequenceSimilarity(features.liveHands, features.templateHands),
    face: sequenceSimilarity(features.liveFace, features.templateFace),
    pose: sequenceSimilarity(features.livePose, features.templatePose),
    motion: motionSimilarity(features.liveMotion, features.templateMotion),
    temporal: features.temporalCoverage,
  });
}
