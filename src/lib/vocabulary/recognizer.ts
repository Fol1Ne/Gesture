import type { RecognitionCandidate, VisionFrame } from "@/types";
import { createLandmarkSample } from "@/lib/database/templates";
import type { LandmarkSample } from "@/lib/database/schema";
import type { PersonalSign } from "./types";

function distance(a: number[][], b: number[][]): number {
  const frames = Math.min(a.length, b.length);
  if (frames === 0) return Number.POSITIVE_INFINITY;

  let total = 0;
  let count = 0;
  for (let i = 0; i < frames; i++) {
    const width = Math.min(a[i].length, b[i].length);
    for (let j = 0; j < width; j++) {
      total += Math.abs(a[i][j] - b[i][j]);
      count++;
    }
  }

  return count === 0 ? Number.POSITIVE_INFINITY : total / count;
}

function similarity(live: LandmarkSample, saved: LandmarkSample): number {
  const scores = [
    distance(live.face, saved.face),
    distance(live.leftHand, saved.leftHand),
    distance(live.rightHand, saved.rightHand),
    distance(live.pose, saved.pose),
    distance(live.motion, saved.motion),
    distance(live.jointAngles, saved.jointAngles),
  ].filter(Number.isFinite);

  if (scores.length === 0) return 0;
  const averageDistance = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  return Math.max(0, 1 - averageDistance);
}

export function recognizePersonalSign(
  frames: readonly VisionFrame[],
  signs: readonly PersonalSign[]
): (RecognitionCandidate & { signId: string; sampleIndex: number }) | null {
  if (frames.length < 8 || signs.length === 0) return null;

  const live = createLandmarkSample(frames, "live");
  let best: (RecognitionCandidate & { signId: string; sampleIndex: number }) | null = null;

  for (const sign of signs) {
    sign.samples.forEach((sample, sampleIndex) => {
      const confidence = similarity(live, sample);
      if (!best || confidence > best.confidence) {
        best = {
          label: sign.word.toUpperCase().replace(/\s+/g, "_"),
          confidence,
          kind: "word",
          databaseScore: confidence,
          signId: sign.id,
          sampleIndex,
        };
      }
    });
  }

  return best;
}
