"use client";

import { Activity, Database, ScanFace, Timer, Waves } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";

function StatusDot({ active }: { active: boolean }) {
  return (
    <span
      className={`h-2 w-2 rounded-full ${
        active ? "bg-[var(--success)] shadow-[0_0_12px_var(--success)]" : "bg-[var(--border)]"
      }`}
    />
  );
}

function Metric({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3">
      <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
        {icon}
        {label}
      </div>
      <div className="font-mono text-lg font-semibold text-[var(--text)]">{value}</div>
    </div>
  );
}

export function RecognitionPanel() {
  const currentSign = useAppStore((s) => s.currentSign);
  const currentConfidence = useAppStore((s) => s.currentConfidence);
  const fps = useAppStore((s) => s.fps);
  const debug = useAppStore((s) => s.debugMetrics);

  const tracking = [
    ["Face", debug.tracking.face],
    ["Pose", debug.tracking.pose],
    ["Left Hand", debug.tracking.leftHand],
    ["Right Hand", debug.tracking.rightHand],
  ] as const;

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.24)]">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-[var(--text)]">Recognition Debug</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">Holistic landmark pipeline</p>
        </div>
        <span className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
          {debug.recognitionStatus}
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-4 lg:grid-cols-2">
        {tracking.map(([label, active]) => (
          <div
            key={label}
            className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--text)]"
          >
            {label}
            <StatusDot active={active} />
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Metric
          label="Current Sign"
          value={currentSign ?? "None"}
          icon={<Waves size={13} />}
        />
        <Metric
          label="Confidence"
          value={`${Math.round(currentConfidence * 100)}%`}
          icon={<Activity size={13} />}
        />
        <Metric
          label="Frame Buffer"
          value={`${debug.frameBufferSize} frames`}
          icon={<Timer size={13} />}
        />
        <Metric
          label="Database Match"
          value={`${Math.round(debug.databaseMatch * 100)}%`}
          icon={<Database size={13} />}
        />
        <Metric
          label="Vocabulary"
          value={`${debug.totalSigns} signs`}
          icon={<Database size={13} />}
        />
        <Metric
          label="Recorded"
          value={`${debug.signsWithSamples}/${debug.totalSigns}`}
          icon={<Database size={13} />}
        />
        <Metric
          label="Landmarks"
          value={`${debug.landmarkCount}/543`}
          icon={<ScanFace size={13} />}
        />
        <Metric
          label="Face"
          value={`${debug.faceLandmarkCount}`}
          icon={<ScanFace size={13} />}
        />
        <Metric
          label="Pose"
          value={`${debug.poseLandmarkCount}`}
          icon={<ScanFace size={13} />}
        />
        <Metric
          label="Hands"
          value={`${debug.leftHandLandmarkCount}/${debug.rightHandLandmarkCount}`}
          icon={<ScanFace size={13} />}
        />
        <Metric label="FPS" value={`${fps}`} icon={<Activity size={13} />} />
      </div>
    </section>
  );
}
