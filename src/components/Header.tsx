import { Hand } from "lucide-react";

export function Header() {
  return (
    <header className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4 lg:px-10">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent)] text-white">
          <Hand size={16} strokeWidth={2.25} />
        </div>
        <span className="text-[15px] font-semibold tracking-tight text-[var(--text)]">
          Gesture
        </span>
      </div>
      <span className="hidden text-xs text-[var(--muted)] sm:block">
        Real-time ASL translation for meetings
      </span>
    </header>
  );
}
