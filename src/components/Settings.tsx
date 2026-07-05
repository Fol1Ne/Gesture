"use client";

import {
  Camera,
  Layers,
  MonitorUp,
  Moon,
  Play,
  Square,
  Sun,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { DEFAULT_VOICES } from "@/lib/services/speech";
import type { InputSource } from "@/types";

interface SettingsProps {
  onStart: (source: InputSource) => void;
  onStop: () => void;
}

function Toggle({
  checked,
  onChange,
  label,
  icon,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 py-3 text-left transition hover:border-[var(--accent)]/40"
    >
      <span className="flex items-center gap-2.5 text-sm text-[var(--text)]">
        {icon}
        {label}
      </span>
      <span
        className={`relative h-5 w-9 rounded-full transition ${
          checked ? "bg-[var(--accent)]" : "bg-[var(--border)]"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${
            checked ? "left-[18px]" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
}

export function Settings({ onStart, onStop }: SettingsProps) {
  const cameraStatus = useAppStore((s) => s.cameraStatus);
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);

  const isRunning = cameraStatus === "running" || cameraStatus === "loading";

  return (
    <aside className="flex w-full flex-col gap-5 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.24)] xl:sticky xl:top-6 xl:w-full xl:self-start">
      <div>
        <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">Capture</h2>
        <div className="flex gap-2">
          {!isRunning ? (
            <button
              onClick={() => onStart(settings.inputSource)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-3 py-2.5 text-sm font-semibold text-[#0D1117] transition hover:opacity-90"
            >
              <Play size={15} />
              Start {settings.inputSource === "webcam" ? "Camera" : "Screen Share"}
            </button>
          ) : (
            <button
              onClick={onStop}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--danger)] px-3 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
            >
              <Square size={14} />
              Stop
            </button>
          )}
        </div>

        <div className="mt-2 flex rounded-xl bg-[var(--bg)] p-1 text-xs font-medium">
          <button
            onClick={() => updateSettings({ inputSource: "webcam" })}
            disabled={isRunning}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 transition disabled:opacity-50 ${
              settings.inputSource === "webcam"
                ? "bg-[var(--card)] text-[var(--text)] shadow-sm"
                : "text-[var(--muted)]"
            }`}
          >
            <Camera size={13} />
            Webcam
          </button>
          <button
            onClick={() => updateSettings({ inputSource: "screen" })}
            disabled={isRunning}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 transition disabled:opacity-50 ${
              settings.inputSource === "screen"
                ? "bg-[var(--card)] text-[var(--text)] shadow-sm"
                : "text-[var(--muted)]"
            }`}
          >
            <MonitorUp size={13} />
            Screen
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <h2 className="text-sm font-semibold text-[var(--text)]">Modes</h2>
        <Toggle
          checked={settings.overlayMode}
          onChange={(v) => updateSettings({ overlayMode: v })}
          label="Overlay mode"
          icon={<Layers size={15} />}
        />
        <Toggle
          checked={settings.voiceEnabled}
          onChange={(v) => updateSettings({ voiceEnabled: v })}
          label="Voice output"
          icon={settings.voiceEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
        />
        <Toggle
          checked={settings.darkMode}
          onChange={(v) => updateSettings({ darkMode: v })}
          label="Dark mode"
          icon={settings.darkMode ? <Moon size={15} /> : <Sun size={15} />}
        />
      </div>

      {settings.voiceEnabled && (
        <div className="flex flex-col gap-2.5 rounded-xl border border-[var(--border)] p-3.5">
          <label className="text-xs font-medium text-[var(--muted)]">
            ElevenLabs API key
          </label>
          <input
            type="password"
            value={settings.elevenLabsApiKey}
            onChange={(e) => updateSettings({ elevenLabsApiKey: e.target.value })}
            placeholder="sk_..."
            className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2.5 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
          />
          <label className="mt-1 text-xs font-medium text-[var(--muted)]">Voice</label>
          <select
            value={settings.voiceId}
            onChange={(e) => updateSettings({ voiceId: e.target.value })}
            className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2.5 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
          >
            {DEFAULT_VOICES.map((v) => (
              <option key={v.voice_id} value={v.voice_id}>
                {v.name}
              </option>
            ))}
          </select>
          <p className="text-[11px] leading-snug text-[var(--muted)]">
            Key is kept in memory only and sent directly to ElevenLabs.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-[var(--muted)]">
            Confidence threshold
          </label>
          <span className="text-xs font-medium text-[var(--text)]">
            {Math.round(settings.confidenceThreshold * 100)}%
          </span>
        </div>
        <input
          type="range"
          min={0.3}
          max={0.95}
          step={0.05}
          value={settings.confidenceThreshold}
          onChange={(e) =>
            updateSettings({ confidenceThreshold: parseFloat(e.target.value) })
          }
          className="accent-[var(--accent)]"
        />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-[var(--muted)]">
            Frames to confirm a sign
          </label>
          <span className="text-xs font-medium text-[var(--text)]">
            {settings.stableFramesRequired}
          </span>
        </div>
        <input
          type="range"
          min={3}
          max={20}
          step={1}
          value={settings.stableFramesRequired}
          onChange={(e) =>
            updateSettings({ stableFramesRequired: parseInt(e.target.value, 10) })
          }
          className="accent-[var(--accent)]"
        />
      </div>
    </aside>
  );
}
