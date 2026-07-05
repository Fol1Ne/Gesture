import type { VisionFrame } from "@/types";

export type LandmarkChannel = "leftHand" | "rightHand" | "pose" | "face";

export interface AslLandmarkEntry {
  id: string;
  english: string;
  category: string;
  gloss: string;
  landmarks: Record<LandmarkChannel, number[][]>;
  motionSequence: number[][];
  wireframeFrames: Pick<VisionFrame, "hands" | "pose" | "face">[];
  requiredFacialFeatures: string[];
  requiredChannels: LandmarkChannel[];
  confidenceThreshold: number;
  commonConfusions: string[];
  datasetSource: "Internal" | "WLASL" | "ASLLVD" | "How2Sign";
}

export const internalAslDatabase: AslLandmarkEntry[] = [
  {
    id: "hello",
    english: "Hello",
    category: "Greeting",
    gloss: "HELLO",
    landmarks: { leftHand: [], rightHand: [], pose: [], face: [] },
    motionSequence: [],
    wireframeFrames: [],
    requiredFacialFeatures: [],
    requiredChannels: ["rightHand", "pose", "face"],
    confidenceThreshold: 0.85,
    commonConfusions: ["THANK_YOU", "STOP"],
    datasetSource: "Internal",
  },
  {
    id: "thank_you",
    english: "Thank you",
    category: "Courtesy",
    gloss: "THANK YOU",
    landmarks: { leftHand: [], rightHand: [], pose: [], face: [] },
    motionSequence: [],
    wireframeFrames: [],
    requiredFacialFeatures: ["mouth"],
    requiredChannels: ["rightHand", "pose", "face"],
    confidenceThreshold: 0.8,
    commonConfusions: ["HELLO"],
    datasetSource: "Internal",
  },
  {
    id: "i_love_you",
    english: "I love you",
    category: "Phrase",
    gloss: "I LOVE YOU",
    landmarks: { leftHand: [], rightHand: [], pose: [], face: [] },
    motionSequence: [],
    wireframeFrames: [],
    requiredFacialFeatures: ["eyebrows", "mouth"],
    requiredChannels: ["rightHand", "face"],
    confidenceThreshold: 0.85,
    commonConfusions: ["Y", "L"],
    datasetSource: "Internal",
  },
  {
    id: "stop",
    english: "Stop",
    category: "Command",
    gloss: "STOP",
    landmarks: { leftHand: [], rightHand: [], pose: [], face: [] },
    motionSequence: [],
    wireframeFrames: [],
    requiredFacialFeatures: [],
    requiredChannels: ["rightHand", "pose"],
    confidenceThreshold: 0.75,
    commonConfusions: ["B"],
    datasetSource: "Internal",
  },
];

export function findAslEntry(label: string): AslLandmarkEntry | null {
  return internalAslDatabase.find((entry) => entry.gloss === label) ?? null;
}
