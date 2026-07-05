"use client";

import { forwardRef } from "react";
import { Camera, CircleDashed, Gauge, Video } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";

interface CameraViewProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

export const CameraView = forwardRef<HTMLDivElement, CameraViewProps>(
  function CameraView({ videoRef, canvasRef }, ref) {
    const cameraStatus = useAppStore((s) => s.cameraStatus);
    const loadingMessage = useAppStore((s) => s.loadingMessage);
    const errorMessage = useAppStore((s) => s.errorMessage);
    const currentSign = useAppStore((s) => s.currentSign);
    const currentConfidence = useAppStore((s) => s.currentConfidence);
    const fps = useAppStore((s) => s.fps);
    const inputSource = useAppStore((s) => s.settings.inputSource);
    const landmarkCount = useAppStore((s) => s.debugMetrics.landmarkCount);

    const isRunning = cameraStatus === "running";
    const isLoading = cameraStatus === "loading";

    return (
      <div
        ref={ref}
        className="relative w-full overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-[0_18px_60px_rgba(0,0,0,0.28)]"
      >
        <div className="relative aspect-video w-full bg-[#0B0D12]">
          <video
            ref={videoRef}
            className="h-full w-full object-cover -scale-x-100"
            playsInline
            muted
          />
          <canvas
            ref={canvasRef}
            className="pointer-events-none absolute inset-0 h-full w-full -scale-x-100"
          />

          {!isRunning && !isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/70">
              <Video size={36} strokeWidth={1.5} />
              <p className="text-sm">
                {inputSource === "webcam" ? "Camera is off" : "Screen share is off"}
              </p>
            </div>
          )}

          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/80">
              <CircleDashed className="animate-spin" size={32} strokeWidth={1.5} />
              <p className="text-sm">{loadingMessage}</p>
            </div>
          )}

          {errorMessage && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 px-6 text-center text-white">
              <p className="text-sm font-medium">Couldn&apos;t start capture</p>
              <p className="text-xs text-white/70">{errorMessage}</p>
            </div>
          )}

          {isRunning && (
            <>
              <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/50 px-3 py-1.5 text-xs font-medium text-white backdrop-blur">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--success)]" />
                Live wireframe
              </div>
              <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 text-xs font-medium text-white backdrop-blur">
                <Gauge size={13} />
                {fps} FPS
              </div>
              <div className="absolute right-3 top-12 rounded-full bg-black/50 px-3 py-1.5 text-xs font-medium text-white/80 backdrop-blur">
                {landmarkCount}/543 landmarks
              </div>
              {currentSign && (
                <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-xl bg-black/60 px-3.5 py-2 backdrop-blur">
                  <Camera size={14} className="text-[var(--accent)]" />
                  <div>
                    <p className="text-sm font-semibold leading-none text-white">
                      {currentSign}
                    </p>
                    <p className="mt-1 text-[11px] leading-none text-white/60">
                      {Math.round(currentConfidence * 100)}% confidence
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }
);
