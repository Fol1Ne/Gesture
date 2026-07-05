"use client";

import { useState } from "react";
import { Check, Copy, MessageSquareText, Trash2 } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";

export function Transcript() {
  const activeSentence = useAppStore((s) => s.activeSentence);
  const transcript = useAppStore((s) => s.transcript);
  const clearTranscript = useAppStore((s) => s.clearTranscript);
  const [chatValue, setChatValue] = useState("");
  const [copied, setCopied] = useState(false);

  const fullText = [...transcript.map((t) => t.text), activeSentence]
    .filter(Boolean)
    .join(" ");

  const handleCopy = async () => {
    if (!fullText) return;
    await navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleInsert = () => {
    if (!fullText) return;
    setChatValue((prev) => (prev ? `${prev} ${fullText}` : fullText));
  };

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.24)]">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--text)]">Transcript</h2>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCopy}
            disabled={!fullText}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[var(--muted)] transition hover:bg-[var(--bg)] hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            onClick={clearTranscript}
            disabled={!fullText}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[var(--muted)] transition hover:bg-[var(--bg)] hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 size={13} />
            Clear
          </button>
        </div>
      </div>

      <div
        className="min-h-[88px] rounded-xl bg-[var(--bg)] p-4 text-[15px] leading-relaxed text-[var(--text)]"
        aria-live="polite"
      >
        {fullText ? (
          <p>
            {transcript.map((t) => (
              <span key={t.id}>{t.text} </span>
            ))}
            {activeSentence && (
              <span className="text-[var(--accent)]">{activeSentence}</span>
            )}
          </p>
        ) : (
          <p className="text-[var(--muted)]">
            Signed words will appear here as stable text once recognized.
          </p>
        )}
      </div>

      <div className="border-t border-[var(--border)] pt-4">
        <div className="mb-2 flex items-center justify-between">
          <label
            htmlFor="chat-insert"
            className="flex items-center gap-1.5 text-xs font-medium text-[var(--muted)]"
          >
            <MessageSquareText size={13} />
            Chat input mode — demo textbox
          </label>
          <button
            onClick={handleInsert}
            disabled={!fullText}
            className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[#0D1117] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Insert
          </button>
        </div>
        <textarea
          id="chat-insert"
          value={chatValue}
          onChange={(e) => setChatValue(e.target.value)}
          placeholder="Signed text lands here — paste into Slack, Teams, or any form field."
          rows={3}
          className="w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3 text-sm text-[var(--text)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent)]"
        />
      </div>
    </div>
  );
}
