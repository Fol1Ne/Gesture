import type { VisionFrame } from "@/types";
import type { MotionFrame, MotionType } from "@/lib/vision/motion";

export type LandmarkChannel = "leftHand" | "rightHand" | "pose" | "face";
export type DatasetSource = "Internal" | "WLASL" | "ASLLVD" | "How2Sign";

export interface LandmarkSample {
  id: string;
  face: number[][];
  leftHand: number[][];
  rightHand: number[][];
  pose: number[][];
  motion: number[][];
  motionFeatures?: MotionFrame[];
  jointAngles: number[][];
  capturedAt?: number;
  signerId?: string;
}

export interface AslLandmarkEntry {
  id: string;
  english: string;
  word: string;
  category: string;
  gloss: string;
  samples: LandmarkSample[];
  aliases: string[];
  wireframeFrames: Pick<VisionFrame, "hands" | "pose" | "face">[];
  requiredFacialFeatures: string[];
  requiredChannels: LandmarkChannel[];
  confidenceThreshold: number;
  cooldownMs: number;
  requiresFace: boolean;
  requiresPose: boolean;
  temporalLength: number;
  motionType: MotionType;
  commonConfusions: string[];
  datasetSource: DatasetSource;
}

interface VocabularySeed {
  english: string;
  gloss?: string;
  category: string;
  threshold?: number;
  requiredFacialFeatures?: string[];
  requiredChannels?: LandmarkChannel[];
  commonConfusions?: string[];
  aliases?: string[];
  cooldownMs?: number;
  temporalLength?: number;
  motionType?: MotionType;
}

const prioritySeeds: VocabularySeed[] = [
  // Existing implemented signs: keep these as baseline entries.
  {
    english: "Hello",
    gloss: "HELLO",
    category: "Essential Conversation",
    threshold: 0.7,
    requiredChannels: ["rightHand"],
    commonConfusions: ["THANK_YOU", "STOP"],
  },
  {
    english: "I love you",
    gloss: "I LOVE YOU",
    category: "Essential Conversation",
    threshold: 0.7,
    requiredChannels: ["rightHand"],
    commonConfusions: ["Y", "L"],
  },

  ...[
    "Hi",
    "Goodbye",
    "Yes",
    "No",
    "Please",
    "Thank You",
    "You're Welcome",
    "Sorry",
    "Excuse Me",
    "Help",
    "Stop",
    "Wait",
    "Come",
    "Go",
    "Need",
    "Want",
    "Like",
    "Understand",
    "Don't Understand",
    "Again",
    "Finished",
    "Start",
  ].map((english) => ({ english, category: "Essential Conversation" })),

  ...["I", "Me", "You", "We", "Us", "They", "Them", "He", "She", "It"].map(
    (english) => ({
      english,
      category: "Pronouns",
      threshold: 0.78,
    })
  ),

  ...["Who", "What", "Where", "When", "Why", "Which", "How"].map((english) => ({
    english,
    category: "Question Words",
    requiredFacialFeatures: ["eyebrows"],
  })),

  ...[
    "Work",
    "Meeting",
    "Team",
    "Employee",
    "Manager",
    "Office",
    "Company",
    "Business",
    "Customer",
    "Client",
    "Project",
    "Presentation",
    "Interview",
    "Schedule",
    "Deadline",
    "Report",
    "Training",
    "Email",
    "Computer",
    "Document",
  ].map((english) => ({ english, category: "Workplace Vocabulary" })),

  ...[
    "Laptop",
    "Phone",
    "Camera",
    "Screen",
    "Video",
    "Audio",
    "Chat",
    "Message",
    "Website",
    "Internet",
    "Login",
    "Password",
    "Upload",
    "Download",
    "File",
    "Folder",
  ].map((english) => ({ english, category: "Technology" })),

  ...[
    "Good",
    "Bad",
    "Happy",
    "Sad",
    "Angry",
    "Excited",
    "Tired",
    "Easy",
    "Hard",
    "Big",
    "Small",
    "Fast",
    "Slow",
    "New",
    "Old",
    "Beautiful",
    "Different",
    "Same",
  ].map((english) => ({ english, category: "Daily Conversation" })),

  ...[
    "Today",
    "Tomorrow",
    "Yesterday",
    "Morning",
    "Afternoon",
    "Evening",
    "Night",
    "Now",
    "Later",
    "Soon",
    "Week",
    "Month",
    "Year",
  ].map((english) => ({ english, category: "Time" })),

  ...[
    "Water",
    "Coffee",
    "Tea",
    "Food",
    "Breakfast",
    "Lunch",
    "Dinner",
    "Apple",
    "Bread",
    "Pizza",
  ].map((english) => ({ english, category: "Food & Drink" })),

  ...["Mother", "Father", "Brother", "Sister", "Child", "Friend", "Family"].map(
    (english) => ({ english, category: "Family" })
  ),

  ...[
    "Home",
    "School",
    "Office",
    "Store",
    "Hospital",
    "Restaurant",
    "Airport",
    "Hotel",
    "Bathroom",
  ].map((english) => ({ english, category: "Places" })),
];

const numberSeeds: VocabularySeed[] = [
  ...Array.from({ length: 21 }, (_, value) => ({
    english: `${value}`,
    gloss: `${value}`,
    category: "Numbers",
    threshold: 0.82,
    requiredChannels: ["rightHand", "face"] as LandmarkChannel[],
  })),
  ...[30, 40, 50, 60, 70, 80, 90, 100].map((value) => ({
    english: `${value}`,
    gloss: `${value}`,
    category: "Numbers",
    threshold: 0.82,
    requiredChannels: ["rightHand", "face"] as LandmarkChannel[],
  })),
];

const alphabetSeeds: VocabularySeed[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
  .split("")
  .map((letter) => ({
    english: letter,
    gloss: letter,
    category: "Alphabet",
    threshold: 0.8,
    requiredChannels: ["rightHand", "face"] as LandmarkChannel[],
  }));

function toGloss(english: string): string {
  return english.toUpperCase().replace(/'/g, "").replace(/&/g, "AND").replace(/\s+/g, "_");
}

function normalizeGloss(gloss: string): string {
  return gloss.toUpperCase().replace(/'/g, "").replace(/&/g, "AND").replace(/\s+/g, "_");
}

function toId(gloss: string): string {
  return gloss.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function createEntry(seed: VocabularySeed): AslLandmarkEntry {
  const gloss = normalizeGloss(seed.gloss ?? toGloss(seed.english));
  return {
    id: toId(gloss),
    english: seed.english,
    word: seed.english,
    category: seed.category,
    gloss,
    samples: [],
    aliases: seed.aliases ?? [],
    wireframeFrames: [],
    requiredFacialFeatures: seed.requiredFacialFeatures ?? [],
    requiredChannels: seed.requiredChannels ?? ["rightHand", "pose", "face"],
    confidenceThreshold: seed.threshold ?? 0.85,
    cooldownMs: seed.cooldownMs ?? 1200,
    requiresFace: (seed.requiredChannels ?? ["face"]).includes("face"),
    requiresPose: (seed.requiredChannels ?? ["pose"]).includes("pose"),
    temporalLength: seed.temporalLength ?? 32,
    motionType: seed.motionType ?? "complex",
    commonConfusions: seed.commonConfusions ?? [],
    datasetSource: "Internal",
  };
}

function uniqueByGloss(entries: AslLandmarkEntry[]): AslLandmarkEntry[] {
  return Array.from(new Map(entries.map((entry) => [entry.gloss, entry])).values());
}

export const internalAslDatabase: AslLandmarkEntry[] = uniqueByGloss([
  ...prioritySeeds.map(createEntry),
  ...numberSeeds.map(createEntry),
  ...alphabetSeeds.map(createEntry),
]);

export const REQUIRED_SAMPLES_PER_SIGN = 5;
export const supportedGlosses = internalAslDatabase.map((entry) => entry.gloss);

export function findAslEntry(label: string): AslLandmarkEntry | null {
  const normalized = normalizeGloss(label);
  return (
    internalAslDatabase.find(
      (entry) =>
        normalizeGloss(entry.gloss) === normalized ||
        entry.aliases.some((alias) => normalizeGloss(alias) === normalized)
    ) ?? null
  );
}

export function databaseCoverage() {
  const signsWithSamples = internalAslDatabase.filter(
    (entry) => entry.samples.length >= REQUIRED_SAMPLES_PER_SIGN
  ).length;

  return {
    totalSigns: internalAslDatabase.length,
    signsWithSamples,
    requiredSamplesPerSign: REQUIRED_SAMPLES_PER_SIGN,
  };
}
