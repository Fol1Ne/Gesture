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
import { synthesizeSpeech } from "@/lib/services/speech";
import type { InputSource } from "@/types";

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { start, stop } = useVisionEngine(videoRef, canvasRef);

  const settings = useAppStore((s) => s.settings);
  const transcript = useAppStore((s) => s.transcript);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastSpokenIdRef = useRef<string | null>(null);

  // Dark mode: toggle a class on <html> so the whole design-token set flips.
  useEffect(() => {
    document.documentElement.classList.toggle("dark", settings.darkMode);
  }, [settings.darkMode]);

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
            <RecognitionPanel />
            <Transcript />
          </div>
          <Settings onStart={handleStart} onStop={handleStop} />
        </div>
      </main>

      <footer className="border-t border-[var(--border)] px-6 py-4 text-center text-xs text-[var(--muted)] lg:px-10">
        Gesture v3 runs landmark extraction in your browser. Video stays local
        unless voice output is enabled.
      </footer>

      {settings.overlayMode && (
        <Overlay onClose={() => useAppStore.getState().updateSettings({ overlayMode: false })} />
      )}
    </div>
  );
}
