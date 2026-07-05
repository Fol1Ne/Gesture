import type { Point3D } from "@/types";
import type { NormalizedFrame } from "./normalizer";

export type MotionType = "static" | "linear" | "oscillating" | "circular" | "complex";

export interface MotionFrame {
  velocity: Point3D;
  speed: number;
  acceleration: number;
  direction: Point3D;
  paused: boolean;
}

function wrist(frame: NormalizedFrame): Point3D | null {
  return frame.rightHand[0] ?? frame.leftHand[0] ?? null;
}

function delta(a: Point3D, b: Point3D): Point3D {
  return { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
}

function magnitude(point: Point3D): number {
  return Math.hypot(point.x, point.y, point.z);
}

export function extractMotion(frames: readonly NormalizedFrame[]): MotionFrame[] {
  return frames.map((frame, index) => {
    const current = wrist(frame);
    const previous = index > 0 ? wrist(frames[index - 1]) : null;
    const beforePrevious = index > 1 ? wrist(frames[index - 2]) : null;
    if (!current || !previous) {
      return {
        velocity: { x: 0, y: 0, z: 0 },
        speed: 0,
        acceleration: 0,
        direction: { x: 0, y: 0, z: 0 },
        paused: true,
      };
    }

    const velocity = delta(previous, current);
    const speed = magnitude(velocity);
    const previousSpeed = beforePrevious ? magnitude(delta(beforePrevious, previous)) : 0;
    const acceleration = speed - previousSpeed;

    return {
      velocity,
      speed,
      acceleration,
      direction: speed > 0 ? { x: velocity.x / speed, y: velocity.y / speed, z: velocity.z / speed } : velocity,
      paused: speed < 0.015,
    };
  });
}

export function classifyMotion(motion: readonly MotionFrame[]): MotionType {
  if (motion.length === 0) return "static";
  const movingFrames = motion.filter((frame) => !frame.paused);
  if (movingFrames.length < motion.length * 0.2) return "static";

  let xReversals = 0;
  let yReversals = 0;
  for (let i = 1; i < movingFrames.length; i++) {
    const prev = movingFrames[i - 1].direction;
    const next = movingFrames[i].direction;
    if (Math.sign(prev.x) !== Math.sign(next.x) && Math.abs(next.x) > 0.2) xReversals++;
    if (Math.sign(prev.y) !== Math.sign(next.y) && Math.abs(next.y) > 0.2) yReversals++;
  }

  if (xReversals >= 2 || yReversals >= 2) return "oscillating";
  if (xReversals >= 1 && yReversals >= 1) return "circular";
  return "linear";
}
