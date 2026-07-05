// ---------------------------------------------------------------------------
// DEMO RECOGNITION ENGINE
// ---------------------------------------------------------------------------
// IMPORTANT / HONEST NOTE FOR WHOEVER PICKS THIS UP:
//
// This is a geometric, rule-based classifier over a small fixed vocabulary.
// It is NOT a trained ASL model, and it is not a substitute for one. Real
// ASL recognition needs a temporal model trained on WLASL / How2Sign (or
// similar), because sign meaning depends on movement trajectory, facial
// grammar, and handshape transitions that simple per-frame geometry cannot
// capture. Building/training that model was out of scope for this build.
//
// What this DOES do: turn MediaPipe hand+pose landmarks into a small set of
// canonical handshapes, then pattern-match a handful of common signs plus
// static fingerspelling letters, purely so the rest of the pipeline
// (buffering -> smoothing -> transcript -> speech -> UI) has something real
// to run end-to-end.
//
// TO SWAP IN A REAL MODEL: implement `RecognizerEngine` with a model that
// consumes `VisionFrame[]` (see buffer.ts) and produces `RecognitionCandidate`.
// Nothing else in the app needs to change.
// ---------------------------------------------------------------------------

import type {
  HandFrame,
  Point3D,
  RecognitionCandidate,
  RecognizerEngineInfo,
  VisionFrame,
} from "@/types";
import { supportedGlosses } from "@/lib/database/schema";
import { matchLandmarkTemplate } from "@/lib/database/templates";

export interface RecognizerEngine {
  info: RecognizerEngineInfo;
  classify(window: readonly VisionFrame[]): RecognitionCandidate | null;
}

export const templateRecognizer: RecognizerEngine = {
  info: {
    name: "Internal Landmark Template Recognizer",
    vocabulary: supportedGlosses,
    isPretrained: false,
  },

  classify(window) {
    if (window.length < 8) return null;
    const match = matchLandmarkTemplate(window);
    if (!match) return null;

    return {
      label: match.gloss,
      confidence: match.confidence,
      kind: match.gloss.length === 1 ? "letter" : "word",
    };
  },
};

type FingerState = "extended" | "curled";

interface HandShapeFeatures {
  thumb: FingerState;
  index: FingerState;
  middle: FingerState;
  ring: FingerState;
  pinky: FingerState;
}

function dist(a: Point3D, b: Point3D): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

/** Landmark indices per MediaPipe's 21-point hand model. */
const WRIST = 0;
const FINGER_TIPS = { thumb: 4, index: 8, middle: 12, ring: 16, pinky: 20 };
const FINGER_PIPS = { thumb: 2, index: 6, middle: 10, ring: 14, pinky: 18 };

function fingerState(
  landmarks: Point3D[],
  tip: number,
  pip: number
): FingerState {
  const wrist = landmarks[WRIST];
  const tipDist = dist(landmarks[tip], wrist);
  const pipDist = dist(landmarks[pip], wrist);
  // Extended fingers have the tip meaningfully farther from the wrist
  // than the middle joint; curled fingers fold the tip back toward it.
  return tipDist > pipDist * 1.15 ? "extended" : "curled";
}

function extractHandShape(hand: HandFrame): HandShapeFeatures {
  const lm = hand.landmarks;
  return {
    thumb: fingerState(lm, FINGER_TIPS.thumb, FINGER_PIPS.thumb),
    index: fingerState(lm, FINGER_TIPS.index, FINGER_PIPS.index),
    middle: fingerState(lm, FINGER_TIPS.middle, FINGER_PIPS.middle),
    ring: fingerState(lm, FINGER_TIPS.ring, FINGER_PIPS.ring),
    pinky: fingerState(lm, FINGER_TIPS.pinky, FINGER_PIPS.pinky),
  };
}

function shapeKey(s: HandShapeFeatures): string {
  return `${s.thumb[0]}${s.index[0]}${s.middle[0]}${s.ring[0]}${s.pinky[0]}`;
}

function netMotion(window: readonly VisionFrame[]): { dx: number; dy: number } {
  if (window.length < 2) return { dx: 0, dy: 0 };
  const first = window[0].hands[0]?.landmarks[WRIST];
  const last = window[window.length - 1].hands[0]?.landmarks[WRIST];
  if (!first || !last) return { dx: 0, dy: 0 };
  return { dx: last.x - first.x, dy: last.y - first.y };
}

function horizontalOscillation(window: readonly VisionFrame[]): number {
  // Counts direction reversals in wrist x-position — a crude "waving" detector.
  let reversals = 0;
  let prevDx: number | null = null;
  for (let i = 1; i < window.length; i++) {
    const a = window[i - 1].hands[0]?.landmarks[WRIST];
    const b = window[i].hands[0]?.landmarks[WRIST];
    if (!a || !b) continue;
    const dx = b.x - a.x;
    if (Math.abs(dx) < 0.002) continue;
    const dir = Math.sign(dx);
    if (prevDx !== null && dir !== prevDx) reversals++;
    prevDx = dir;
  }
  return reversals;
}

/** True ILY handshape: thumb + index + pinky extended, middle + ring curled. */
function isILY(s: HandShapeFeatures): boolean {
  return (
    s.thumb === "extended" &&
    s.index === "extended" &&
    s.pinky === "extended" &&
    s.middle === "curled" &&
    s.ring === "curled"
  );
}

function isOpenPalm(s: HandShapeFeatures): boolean {
  return (
    s.thumb === "extended" &&
    s.index === "extended" &&
    s.middle === "extended" &&
    s.ring === "extended" &&
    s.pinky === "extended"
  );
}

function isFist(s: HandShapeFeatures): boolean {
  return (
    s.thumb === "curled" &&
    s.index === "curled" &&
    s.middle === "curled" &&
    s.ring === "curled" &&
    s.pinky === "curled"
  );
}

function isThumbsUp(s: HandShapeFeatures): boolean {
  return (
    s.thumb === "extended" &&
    s.index === "curled" &&
    s.middle === "curled" &&
    s.ring === "curled" &&
    s.pinky === "curled"
  );
}

function isPoint(s: HandShapeFeatures): boolean {
  return (
    s.index === "extended" &&
    s.middle === "curled" &&
    s.ring === "curled" &&
    s.pinky === "curled"
  );
}

/** Word-level demo vocabulary. Order matters: more specific checks first. */
export const demoRecognizer: RecognizerEngine = {
  info: {
    name: "Rule-Based Demo Recognizer",
    vocabulary: supportedGlosses,
    isPretrained: false,
  },

  classify(window) {
    const latest = window[window.length - 1];
    if (!latest || latest.hands.length === 0) return null;

    const hand = latest.hands[0];
    const shape = extractHandShape(hand);
    const wrist = hand.landmarks[WRIST];
    const faceY = latest.pose?.landmarks?.[0]?.y ?? 0.25; // nose, roughly
    const shoulderY =
      latest.pose?.landmarks?.[11]?.y ?? latest.pose?.landmarks?.[12]?.y ?? 0.5;

    const nearFace = wrist.y < faceY + 0.12;
    const nearChest = wrist.y >= faceY + 0.12 && wrist.y < shoulderY + 0.2;
    const oscillation = horizontalOscillation(window);
    const motion = netMotion(window);

    // HELLO: open palm, near/above face height, waving side to side.
    if (isOpenPalm(shape) && nearFace && oscillation >= 2) {
      return { label: "HELLO", confidence: 0.9, kind: "word" };
    }

    // I LOVE YOU: canonical ILY handshape, roughly static.
    if (isILY(shape)) {
      return { label: "I LOVE YOU", confidence: 0.92, kind: "word" };
    }

    // STOP: open palm held facing forward near chest, little motion.
    if (
      isOpenPalm(shape) &&
      nearChest &&
      Math.abs(motion.dx) < 0.03 &&
      Math.abs(motion.dy) < 0.03
    ) {
      return { label: "STOP", confidence: 0.75, kind: "word" };
    }

    // THANK YOU: open palm starting near chin/face moving outward/down.
    if (isOpenPalm(shape) && nearFace && motion.dy > 0.05) {
      return { label: "THANK YOU", confidence: 0.8, kind: "word" };
    }

    // PLEASE: open palm on chest with a small circular/flat rub (low net
    // displacement but the hand stayed near chest across the window).
    if (
      isOpenPalm(shape) &&
      nearChest &&
      Math.abs(motion.dx) < 0.05 &&
      Math.abs(motion.dy) < 0.05 &&
      oscillation >= 1
    ) {
      return { label: "PLEASE", confidence: 0.68, kind: "word" };
    }

    // YES: fist moving up and down (like a nodding fist / knocking).
    if (isFist(shape) && Math.abs(motion.dy) > 0.02 && oscillation >= 1) {
      return { label: "YES", confidence: 0.72, kind: "word" };
    }

    // NO: fingers pinching open/closed near chest — approximated here as
    // a point handshape moving side to side.
    if (isPoint(shape) && nearChest && oscillation >= 2) {
      return { label: "NO", confidence: 0.65, kind: "word" };
    }

    // HELP: thumbs-up resting on the opposite flat palm — approximated
    // with a single hand as a static thumbs-up near chest.
    if (isThumbsUp(shape) && nearChest) {
      return { label: "HELP", confidence: 0.6, kind: "word" };
    }

    return null;
  },
};

// ---------------------------------------------------------------------------
// Fingerspelling: a handful of static ASL alphabet handshapes, geometry-only.
// Real fingerspelling recognition needs per-letter classifiers (orientation,
// thumb position, etc.) — this covers a demo-friendly subset.
// ---------------------------------------------------------------------------

export const fingerspellRecognizer: RecognizerEngine = {
  info: {
    name: "Static Fingerspelling (A-Z catalog, geometry subset active)",
    vocabulary: "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""),
    isPretrained: false,
  },

  classify(window) {
    const latest = window[window.length - 1];
    const hand = latest?.hands[0];
    if (!hand) return null;
    const s = extractHandShape(hand);
    const lm = hand.landmarks;

    if (isOpenPalm(s)) return { label: "B", confidence: 0.7, kind: "letter" };
    if (isFist(s)) return { label: "A", confidence: 0.6, kind: "letter" };

    // L: thumb + index extended, ~90 degrees apart, rest curled.
    if (
      s.thumb === "extended" &&
      s.index === "extended" &&
      s.middle === "curled" &&
      s.ring === "curled" &&
      s.pinky === "curled"
    ) {
      return { label: "L", confidence: 0.65, kind: "letter" };
    }

    // Y: thumb + pinky extended, rest curled ("hang loose").
    if (
      s.thumb === "extended" &&
      s.pinky === "extended" &&
      s.index === "curled" &&
      s.middle === "curled" &&
      s.ring === "curled"
    ) {
      return { label: "Y", confidence: 0.65, kind: "letter" };
    }

    // I: pinky extended only.
    if (
      s.pinky === "extended" &&
      s.thumb === "curled" &&
      s.index === "curled" &&
      s.middle === "curled" &&
      s.ring === "curled"
    ) {
      return { label: "I", confidence: 0.6, kind: "letter" };
    }

    // D: index extended straight up, thumb touches curled middle finger.
    if (
      s.index === "extended" &&
      s.middle === "curled" &&
      s.ring === "curled" &&
      s.pinky === "curled" &&
      dist(lm[FINGER_TIPS.thumb], lm[FINGER_TIPS.middle]) < 0.06
    ) {
      return { label: "D", confidence: 0.55, kind: "letter" };
    }

    // O: all fingertips pinched near the thumb tip.
    const tipsNearThumb = [
      FINGER_TIPS.index,
      FINGER_TIPS.middle,
      FINGER_TIPS.ring,
      FINGER_TIPS.pinky,
    ].every((tip) => dist(lm[tip], lm[FINGER_TIPS.thumb]) < 0.08);
    if (tipsNearThumb) {
      return { label: "O", confidence: 0.55, kind: "letter" };
    }

    return null;
  },
};

export function getShapeDebugKey(hand: HandFrame): string {
  return shapeKey(extractHandShape(hand));
}
