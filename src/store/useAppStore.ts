import { create } from "zustand";
import type { AppSettings, RecognitionDebugMetrics, TranscriptEntry } from "@/types";
import { databaseCoverage } from "@/lib/database/schema";
import { DEFAULT_VOICES } from "@/lib/services/speech";
import type { PersonalSign } from "@/lib/vocabulary/types";

export type CameraStatus = "idle" | "loading" | "running" | "error";

interface AppState {
  // camera / engine lifecycle
  cameraStatus: CameraStatus;
  loadingMessage: string;
  errorMessage: string | null;

  // live recognition readout
  currentSign: string | null;
  currentConfidence: number;
  fps: number;
  activeSentence: string;
  debugMetrics: RecognitionDebugMetrics;

  // transcript history (finalized sentences)
  transcript: TranscriptEntry[];

  // user-trained signs
  personalSigns: PersonalSign[];

  // settings
  settings: AppSettings;

  // actions
  setCameraStatus: (s: CameraStatus) => void;
  setLoadingMessage: (m: string) => void;
  setError: (m: string | null) => void;
  setLiveReadout: (sign: string | null, confidence: number, fps: number) => void;
  setDebugMetrics: (metrics: Partial<RecognitionDebugMetrics>) => void;
  setActiveSentence: (s: string) => void;
  commitSentence: (text: string) => void;
  clearTranscript: () => void;
  setPersonalSigns: (signs: PersonalSign[]) => void;
  upsertPersonalSign: (sign: PersonalSign) => void;
  removePersonalSign: (id: string) => void;
  updateSettings: (partial: Partial<AppSettings>) => void;
}

const defaultSettings: AppSettings = {
  voiceEnabled: false,
  voiceId: DEFAULT_VOICES[0].voice_id,
  elevenLabsApiKey: "",
  confidenceThreshold: 0.6,
  stableFramesRequired: 8,
  overlayMode: false,
  pipMode: false,
  darkMode: true,
  inputSource: "webcam",
};

const defaultDebugMetrics: RecognitionDebugMetrics = {
  ...databaseCoverage(),
  tracking: {
    face: false,
    pose: false,
    leftHand: false,
    rightHand: false,
  },
  recognitionStatus: "idle",
  frameBufferSize: 0,
  databaseMatch: 0,
  landmarkCount: 0,
  faceLandmarkCount: 0,
  poseLandmarkCount: 0,
  leftHandLandmarkCount: 0,
  rightHandLandmarkCount: 0,
};

export const useAppStore = create<AppState>((set) => ({
  cameraStatus: "idle",
  loadingMessage: "",
  errorMessage: null,

  currentSign: null,
  currentConfidence: 0,
  fps: 0,
  activeSentence: "",
  debugMetrics: defaultDebugMetrics,

  transcript: [],
  personalSigns: [],

  settings: defaultSettings,

  setCameraStatus: (s) => set({ cameraStatus: s }),
  setLoadingMessage: (m) => set({ loadingMessage: m }),
  setError: (m) => set({ errorMessage: m, cameraStatus: m ? "error" : "idle" }),
  setLiveReadout: (sign, confidence, fps) =>
    set({ currentSign: sign, currentConfidence: confidence, fps }),
  setDebugMetrics: (metrics) =>
    set((state) => ({
      debugMetrics: {
        ...state.debugMetrics,
        ...metrics,
        tracking: {
          ...state.debugMetrics.tracking,
          ...metrics.tracking,
        },
      },
    })),
  setActiveSentence: (s) => set({ activeSentence: s }),
  commitSentence: (text) =>
    set((state) => ({
      transcript: [
        ...state.transcript,
        { id: crypto.randomUUID(), text, createdAt: Date.now() },
      ],
      activeSentence: "",
    })),
  clearTranscript: () => set({ transcript: [], activeSentence: "" }),
  setPersonalSigns: (signs) => set({ personalSigns: signs }),
  upsertPersonalSign: (sign) =>
    set((state) => ({
      personalSigns: [
        ...state.personalSigns.filter((existing) => existing.id !== sign.id),
        sign,
      ].sort((a, b) => a.word.localeCompare(b.word)),
    })),
  removePersonalSign: (id) =>
    set((state) => ({
      personalSigns: state.personalSigns.filter((sign) => sign.id !== id),
    })),
  updateSettings: (partial) =>
    set((state) => ({ settings: { ...state.settings, ...partial } })),
}));
