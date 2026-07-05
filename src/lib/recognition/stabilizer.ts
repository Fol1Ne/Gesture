import type { RecognitionCandidate } from "@/types";

interface StabilizerOptions {
  requiredFrames: number;
  defaultCooldownMs: number;
}

export class PredictionStabilizer {
  private history: RecognitionCandidate[] = [];
  private lastCommitted: { label: string; at: number } | null = null;
  private options: StabilizerOptions;

  constructor(options: StabilizerOptions) {
    this.options = options;
  }

  setRequiredFrames(requiredFrames: number) {
    this.options.requiredFrames = requiredFrames;
  }

  observe(candidate: RecognitionCandidate | null, now = Date.now()): RecognitionCandidate | null {
    if (!candidate) {
      this.history = [];
      return null;
    }

    const last = this.history[this.history.length - 1];
    this.history = last?.label === candidate.label ? [...this.history, candidate] : [candidate];

    if (this.history.length < this.options.requiredFrames) return null;

    const confidence =
      this.history.reduce((sum, item) => sum + item.confidence, 0) / this.history.length;
    const cooldownMs = candidate.cooldownMs ?? this.options.defaultCooldownMs;
    const isSameAsLast = this.lastCommitted?.label === candidate.label;
    const cooldownActive = isSameAsLast && now - this.lastCommitted!.at < cooldownMs;

    if (cooldownActive || isSameAsLast) {
      this.history = this.history.slice(-this.options.requiredFrames);
      return null;
    }

    const stable = { ...candidate, confidence };
    this.lastCommitted = { label: candidate.label, at: now };
    this.history = [];
    return stable;
  }

  reset() {
    this.history = [];
    this.lastCommitted = null;
  }
}
