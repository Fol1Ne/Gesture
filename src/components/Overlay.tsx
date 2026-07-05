"use client";

import { useRef, useState } from "react";
import { GripHorizontal, X } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";

export function Overlay({ onClose }: { onClose: () => void }) {
  const activeSentence = useAppStore((s) => s.activeSentence);
  const currentSign = useAppStore((s) => s.currentSign);
  const transcript = useAppStore((s) => s.transcript);

  const [pos, setPos] = useState({ x: 24, y: 24 });
  const dragState = useRef<{ dx: number; dy: number } | null>(null);

  const lastCommitted = transcript[transcript.length - 1]?.text ?? "";
  const display = activeSentence || lastCommitted || currentSign || "Listening...";

  const onPointerDown = (e: React.PointerEvent) => {
    dragState.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragState.current) return;
    setPos({ x: e.clientX - dragState.current.dx, y: e.clientY - dragState.current.dy });
  };
  const onPointerUp = () => {
    dragState.current = null;
  };

  return (
    <div
      className="fixed z-50 w-[340px] resize overflow-auto rounded-2xl border border-white/10 bg-black/75 shadow-2xl backdrop-blur-md"
      style={{ left: pos.x, top: pos.y, minWidth: 220, minHeight: 90 }}
    >
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="flex cursor-grab items-center justify-between rounded-t-2xl bg-white/5 px-3 py-2 active:cursor-grabbing"
      >
        <div className="flex items-center gap-1.5 text-white/50">
          <GripHorizontal size={14} />
          <span className="text-[11px] font-medium uppercase tracking-wide">
            Live captions
          </span>
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-white/50 transition hover:bg-white/10 hover:text-white"
        >
          <X size={14} />
        </button>
      </div>
      <div className="px-4 py-4">
        <p className="text-lg font-medium leading-snug text-white">{display}</p>
      </div>
    </div>
  );
}
