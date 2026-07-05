import type { Point3D, VisionFrame } from "@/types";
import { internalAslDatabase, type LandmarkSample } from "./schema";
import { extractMotion } from "@/lib/vision/motion";
import { normalizeWindow } from "@/lib/vision/normalizer";

const TARGET_SEQUENCE_LENGTH = 32;

function flatten(points: Point3D[] | undefined): number[] {
  return (points ?? []).flatMap((point) => [point.x, point.y, point.z]);
}

function resample<T>(items: readonly T[], targetLength: number): T[] {
  if (items.length === 0) return [];
  if (items.length === targetLength) return [...items];

  return Array.from({ length: targetLength }, (_, index) => {
    const sourceIndex = Math.round((index * (items.length - 1)) / Math.max(1, targetLength - 1));
    return items[sourceIndex];
  });
}

function normalizeSequence(sequence: number[][]): number[][] {
  const values = sequence.flat();
  if (values.length === 0) return sequence;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return sequence.map((frame) => frame.map((value) => (value - min) / range));
}

function handFor(frame: VisionFrame, handedness: "Left" | "Right"): number[] {
  return flatten(frame.hands.find((hand) => hand.handedness === handedness)?.landmarks);
}

function motionFor(frames: readonly VisionFrame[]): number[][] {
  return frames.map((frame, index) => {
    if (index === 0) return [0, 0, 0];
    const previous = frames[index - 1].hands[0]?.landmarks[0];
    const current = frame.hands[0]?.landmarks[0];
    if (!previous || !current) return [0, 0, 0];
    return [current.x - previous.x, current.y - previous.y, current.z - previous.z];
  });
}

function angle(a: Point3D | undefined, b: Point3D | undefined, c: Point3D | undefined): number {
  if (!a || !b || !c) return 0;
  const ab = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  const cb = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z };
  const dot = ab.x * cb.x + ab.y * cb.y + ab.z * cb.z;
  const magA = Math.hypot(ab.x, ab.y, ab.z);
  const magC = Math.hypot(cb.x, cb.y, cb.z);
  if (!magA || !magC) return 0;
  return Math.acos(Math.max(-1, Math.min(1, dot / (magA * magC))));
}

function jointAnglesFor(frame: VisionFrame): number[] {
  return frame.hands.flatMap((hand) => {
    const lm = hand.landmarks;
    return [
      angle(lm[0], lm[2], lm[4]),
      angle(lm[0], lm[5], lm[8]),
      angle(lm[0], lm[9], lm[12]),
      angle(lm[0], lm[13], lm[16]),
      angle(lm[0], lm[17], lm[20]),
    ];
  });
}

export function createLandmarkSample(
  frames: readonly VisionFrame[],
  id = crypto.randomUUID()
): LandmarkSample {
  const sampled = resample(frames, TARGET_SEQUENCE_LENGTH);
  const normalized = normalizeWindow(sampled);

  return {
    id,
    face: normalizeSequence(sampled.map((frame) => flatten(frame.face?.landmarks))),
    leftHand: normalizeSequence(sampled.map((frame) => handFor(frame, "Left"))),
    rightHand: normalizeSequence(sampled.map((frame) => handFor(frame, "Right"))),
    pose: normalizeSequence(sampled.map((frame) => flatten(frame.pose?.landmarks))),
    motion: normalizeSequence(motionFor(sampled)),
    motionFeatures: extractMotion(normalized),
    jointAngles: normalizeSequence(sampled.map(jointAnglesFor)),
    capturedAt: Date.now(),
  };
}

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

function sampleSimilarity(live: LandmarkSample, template: LandmarkSample): number {
  const channelScores = [
    distance(live.face, template.face),
    distance(live.leftHand, template.leftHand),
    distance(live.rightHand, template.rightHand),
    distance(live.pose, template.pose),
    distance(live.motion, template.motion),
  ].filter(Number.isFinite);

  if (channelScores.length === 0) return 0;
  const averageDistance =
    channelScores.reduce((sum, value) => sum + value, 0) / channelScores.length;

  return Math.max(0, 1 - averageDistance);
}

export function matchLandmarkTemplate(frames: readonly VisionFrame[]) {
  const liveSample = createLandmarkSample(frames, "live");
  let best: { gloss: string; confidence: number } | null = null;

  for (const entry of internalAslDatabase) {
    for (const sample of entry.samples) {
      const confidence = sampleSimilarity(liveSample, sample);
      if (!best || confidence > best.confidence) {
        best = { gloss: entry.gloss, confidence };
      }
    }
  }

  return best;
}
