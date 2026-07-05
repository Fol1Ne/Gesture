import type { Point3D, VisionFrame } from "@/types";

export interface NormalizedFrame {
  timestampMs: number;
  face: Point3D[];
  leftHand: Point3D[];
  rightHand: Point3D[];
  pose: Point3D[];
}

function center(points: Point3D[]): Point3D {
  if (points.length === 0) return { x: 0.5, y: 0.5, z: 0 };
  const total = points.reduce(
    (sum, point) => ({
      x: sum.x + point.x,
      y: sum.y + point.y,
      z: sum.z + point.z,
    }),
    { x: 0, y: 0, z: 0 }
  );

  return {
    x: total.x / points.length,
    y: total.y / points.length,
    z: total.z / points.length,
  };
}

function distance(a: Point3D | undefined, b: Point3D | undefined, fallback: number) {
  if (!a || !b) return fallback;
  return Math.max(0.001, Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z));
}

function normalizePoints(points: Point3D[], origin: Point3D, scale: number): Point3D[] {
  return points.map((point) => ({
    x: (point.x - origin.x) / scale,
    y: (point.y - origin.y) / scale,
    z: (point.z - origin.z) / scale,
  }));
}

function handScale(hand: Point3D[], fallback: number): number {
  return distance(hand[0], hand[9], fallback);
}

export function normalizeFrame(frame: VisionFrame): NormalizedFrame {
  const pose = frame.pose?.landmarks ?? [];
  const leftHand = frame.hands.find((hand) => hand.handedness === "Left")?.landmarks ?? [];
  const rightHand = frame.hands.find((hand) => hand.handedness === "Right")?.landmarks ?? [];

  const torsoCenter = center([pose[11], pose[12], pose[23], pose[24]].filter(Boolean));
  const shoulderWidth = distance(pose[11], pose[12], 0.25);
  const cameraDistanceScale = Math.max(shoulderWidth, distance(pose[11], pose[23], shoulderWidth));

  return {
    timestampMs: frame.timestampMs,
    face: normalizePoints(frame.face?.landmarks ?? [], torsoCenter, cameraDistanceScale),
    leftHand: normalizePoints(leftHand, torsoCenter, handScale(leftHand, cameraDistanceScale)),
    rightHand: normalizePoints(rightHand, torsoCenter, handScale(rightHand, cameraDistanceScale)),
    pose: normalizePoints(pose, torsoCenter, cameraDistanceScale),
  };
}

export function normalizeWindow(window: readonly VisionFrame[]): NormalizedFrame[] {
  return window.map(normalizeFrame);
}
