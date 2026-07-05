import { Hand } from "lucide-react";

export function Header() {
  return (
    <header className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--card)]/70 px-5 py-4 backdrop-blur lg:px-8">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--accent)] shadow-[0_0_24px_rgba(88,166,255,0.2)]">
          <Hand size={16} strokeWidth={2.25} />
        </div>
        <div>
          <span className="block text-[15px] font-semibold tracking-tight text-[var(--text)]">
            Gesture
          </span>
          <span className="block text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">
            ASL Translator v3
          </span>
        </div>
      </div>
      <span className="hidden rounded-full border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--muted)] sm:block">
        MediaPipe Holistic-style landmark pipeline
      </span>
    </header>
  );
}
