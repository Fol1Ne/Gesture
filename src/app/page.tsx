"use client";

import { useEffect, useRef } from "react";
import { Header } from "@/components/Header";
import { CameraView } from "@/components/CameraView";
import { Transcript } from "@/components/Transcript";
import { Settings } from "@/components/Settings";
import { Overlay } from "@/components/Overlay";
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

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-8 lg:px-10">
        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="flex flex-1 flex-col gap-6">
            <CameraView videoRef={videoRef} canvasRef={canvasRef} />
            <Transcript />
          </div>
          <Settings onStart={handleStart} onStop={handleStop} />
        </div>
      </main>

      <footer className="border-t border-[var(--border)] px-6 py-4 text-center text-xs text-[var(--muted)] lg:px-10">
        Gesture is a hackathon prototype. Recognition runs entirely in your
        browser via MediaPipe — no video leaves your device unless you enable
        voice output.
      </footer>

      {settings.overlayMode && (
        <Overlay onClose={() => useAppStore.getState().updateSettings({ overlayMode: false })} />
      )}
    </div>
  );
}
