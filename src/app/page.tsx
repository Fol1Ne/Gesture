"use client";

import { useEffect, useRef } from "react";
import { Header } from "@/components/Header";
import { CameraView } from "@/components/CameraView";
import { Transcript } from "@/components/Transcript";
import { Settings } from "@/components/Settings";
import { Overlay } from "@/components/Overlay";
import { RecognitionPanel } from "@/components/RecognitionPanel";
import { useVisionEngine } from "@/hooks/useVisionEngine";
import { useAppStore } from "@/store/useAppStore";
import { openTranslatorPictureInPicture } from "@/lib/pip";
import { synthesizeSpeech } from "@/lib/services/speech";
import { applyTheme, getInitialDarkMode } from "@/lib/theme";
import type { InputSource } from "@/types";

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { start, stop } = useVisionEngine(videoRef, canvasRef);

  const settings = useAppStore((s) => s.settings);
  const transcript = useAppStore((s) => s.transcript);
  const activeSentence = useAppStore((s) => s.activeSentence);
  const currentSign = useAppStore((s) => s.currentSign);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastSpokenIdRef = useRef<string | null>(null);
  const pipOpeningRef = useRef(false);
  const pipOpenedRef = useRef(false);

  useEffect(() => {
    updateSettings({ darkMode: getInitialDarkMode() });
  }, [updateSettings]);

  useEffect(() => {
    applyTheme(settings.darkMode);
  }, [settings.darkMode]);

  useEffect(() => {
    if (!settings.pipMode) {
      pipOpenedRef.current = false;
      return;
    }
    if (pipOpeningRef.current || pipOpenedRef.current) return;

    pipOpeningRef.current = true;
    const text = [...transcript.map((t) => t.text), activeSentence].filter(Boolean).join(" ");
    openTranslatorPictureInPicture({
      video: videoRef.current,
      canvas: canvasRef.current,
      currentWord: currentSign,
      transcript: text,
    }).catch((err) => {
      console.error("Picture-in-Picture failed:", err);
      updateSettings({ pipMode: false });
    }).finally(() => {
      pipOpenedRef.current = true;
      pipOpeningRef.current = false;
    });
  }, [settings.pipMode, transcript, activeSentence, currentSign, updateSettings]);

  // Speech output: speak newly committed sentences when voice is enabled.
  useEffect(() => {
    const last = transcript[transcript.length - 1];
    if (!last || last.id === lastSpokenIdRef.current) return;
    if (!settings.voiceEnabled || !settings.elevenLabsApiKey) return;

    lastSpokenIdRef.current = last.id;
    synthesizeSpeech(last.text, settings.elevenLabsApiKey, settings.voiceId)
      .then((url) => {
        audioRef.current?.pause();
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.play().catch(() => {});
      })
      .catch((err) => {
        console.error("Speech synthesis failed:", err);
      });
  }, [transcript, settings.voiceEnabled, settings.elevenLabsApiKey, settings.voiceId]);

  const handleStart = (source: InputSource) => start(source);
  const handleStop = () => stop();

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)]">
      <Header />

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-5 py-6 lg:px-8">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex min-w-0 flex-col gap-6">
            <CameraView videoRef={videoRef} canvasRef={canvasRef} />
            <Transcript />
            <RecognitionPanel />
          </div>
          <Settings onStart={handleStart} onStop={handleStop} />
        </div>
      </main>

      <footer className="border-t border-[var(--border)] px-6 py-4 text-center text-xs text-[var(--muted)] lg:px-10">
        Gesture v4 runs landmark extraction in your browser. Video stays local
        unless voice output is enabled.
      </footer>

      {settings.overlayMode && (
        <Overlay onClose={() => useAppStore.getState().updateSettings({ overlayMode: false })} />
      )}
    </div>
  );
}
