import { create } from "zustand";
import type { AppSettings, TranscriptEntry } from "@/types";
import { DEFAULT_VOICES } from "@/lib/services/speech";

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

  // transcript history (finalized sentences)
  transcript: TranscriptEntry[];

  // settings
  settings: AppSettings;

  // actions
  setCameraStatus: (s: CameraStatus) => void;
  setLoadingMessage: (m: string) => void;
  setError: (m: string | null) => void;
  setLiveReadout: (sign: string | null, confidence: number, fps: number) => void;
  setActiveSentence: (s: string) => void;
  commitSentence: (text: string) => void;
  clearTranscript: () => void;
  updateSettings: (partial: Partial<AppSettings>) => void;
}

const defaultSettings: AppSettings = {
  voiceEnabled: false,
  voiceId: DEFAULT_VOICES[0].voice_id,
  elevenLabsApiKey: "",
  confidenceThreshold: 0.6,
  stableFramesRequired: 8,
  overlayMode: false,
  darkMode: false,
  inputSource: "webcam",
};

export const useAppStore = create<AppState>((set) => ({
  cameraStatus: "idle",
  loadingMessage: "",
  errorMessage: null,

  currentSign: null,
  currentConfidence: 0,
  fps: 0,
  activeSentence: "",

  transcript: [],

  settings: defaultSettings,

  setCameraStatus: (s) => set({ cameraStatus: s }),
  setLoadingMessage: (m) => set({ loadingMessage: m }),
  setError: (m) => set({ errorMessage: m, cameraStatus: m ? "error" : "idle" }),
  setLiveReadout: (sign, confidence, fps) =>
    set({ currentSign: sign, currentConfidence: confidence, fps }),
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
  updateSettings: (partial) =>
    set((state) => ({ settings: { ...state.settings, ...partial } })),
}));
