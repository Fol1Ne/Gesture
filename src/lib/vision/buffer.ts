// Rolling buffer of recent VisionFrames. The recognizer consumes this
// window (default: last ~2-3 seconds at 30fps = ~60-90 frames) instead of
// a single frame, so temporal gestures (not just static handshapes) are
// possible once a real sequence model is dropped in.

import type { VisionFrame } from "@/types";

export class FrameBuffer {
  private frames: VisionFrame[] = [];
  private maxFrames: number;

  constructor(maxFrames = 60) {
    this.maxFrames = maxFrames;
  }

  push(frame: VisionFrame) {
    this.frames.push(frame);
    if (this.frames.length > this.maxFrames) {
      this.frames.shift();
    }
  }

  get(): readonly VisionFrame[] {
    return this.frames;
  }

  latest(): VisionFrame | null {
    return this.frames[this.frames.length - 1] ?? null;
  }

  clear() {
    this.frames = [];
  }

  get length() {
    return this.frames.length;
  }
}

/**
 * Requires N consecutive matching candidate labels before a word is
 * considered "stable" and safe to commit to the transcript. This is what
 * stops "HELLO HELLO HELLO HELLO" from being emitted every frame, per the
 * PRD's smoothing requirement.
 */
export class StabilityVoter {
  private history: { label: string; confidence: number }[] = [];
  private requiredFrames: number;
  private lastCommitted: string | null = null;

  constructor(requiredFrames = 8) {
    this.requiredFrames = requiredFrames;
  }

  setRequiredFrames(n: number) {
    this.requiredFrames = n;
  }

  /**
   * Feed a new candidate (or null if nothing detected this frame).
   * Returns the label to commit, or null if not yet stable / no change.
   */
  observe(candidate: { label: string; confidence: number } | null): string | null {
    if (!candidate) {
      // A gap resets the run but not the "already committed" guard,
      // so a sign held continuously doesn't re-fire every frame, while
      // a sign repeated after a pause CAN fire again.
      this.history = [];
      return null;
    }

    const last = this.history[this.history.length - 1];
    if (last && last.label === candidate.label) {
      this.history.push(candidate);
    } else {
      this.history = [candidate];
    }

    if (this.history.length < this.requiredFrames) return null;

    if (candidate.label === this.lastCommitted) {
      // Still holding the same sign that was already committed; don't
      // spam duplicates. Trim history to avoid unbounded growth.
      this.history = this.history.slice(-this.requiredFrames);
      return null;
    }

    this.lastCommitted = candidate.label;
    this.history = [];
    return candidate.label;
  }

  reset() {
    this.history = [];
    this.lastCommitted = null;
  }
}
