"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Plus, Trash2, Upload } from "lucide-react";
import { createLandmarkSample } from "@/lib/database/templates";
import {
  deletePersonalSign,
  exportVocabulary,
  loadPersonalSigns,
  replacePersonalVocabulary,
  savePersonalSign,
} from "@/lib/vocabulary/db";
import type { PersonalSign, PersonalVocabularyExport } from "@/lib/vocabulary/types";
import { useAppStore } from "@/store/useAppStore";
import type { VisionFrame } from "@/types";

interface VocabularyManagerProps {
  captureRecentFrames: () => VisionFrame[];
}

function slug(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export function VocabularyManager({ captureRecentFrames }: VocabularyManagerProps) {
  const signs = useAppStore((s) => s.personalSigns);
  const setPersonalSigns = useAppStore((s) => s.setPersonalSigns);
  const upsertPersonalSign = useAppStore((s) => s.upsertPersonalSign);
  const removePersonalSign = useAppStore((s) => s.removePersonalSign);
  const fileRef = useRef<HTMLInputElement>(null);

  const [word, setWord] = useState("");
  const [category, setCategory] = useState("");
  const [phrase, setPhrase] = useState("");
  const [notes, setNotes] = useState("");
  const [draftSamples, setDraftSamples] = useState<PersonalSign["samples"]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    loadPersonalSigns()
      .then(setPersonalSigns)
      .catch((err) => setMessage(`Could not load vocabulary: ${err instanceof Error ? err.message : "unknown error"}`));
  }, [setPersonalSigns]);

  const canSave = word.trim() && draftSamples.length > 0;
  const totalSamples = useMemo(
    () => signs.reduce((sum, sign) => sum + sign.samples.length, 0),
    [signs]
  );

  const captureSample = () => {
    const frames = captureRecentFrames();
    if (frames.length < 8) {
      setMessage("Start the camera and sign for 2-3 seconds before recording a sample.");
      return;
    }

    const sample = createLandmarkSample(frames);
    setDraftSamples((prev) => [...prev, sample]);
    setMessage(`Captured sample ${draftSamples.length + 1}. Aim for 5 samples per sign.`);
  };

  const saveSign = async () => {
    if (!canSave) return;
    const now = Date.now();
    const id = slug(word);
    const existing = signs.find((sign) => sign.id === id);
    const sign: PersonalSign = {
      id,
      word: word.trim(),
      category: category.trim() || "Personal",
      phrase: phrase.trim() || undefined,
      notes: notes.trim() || undefined,
      samples: [...(existing?.samples ?? []), ...draftSamples],
      recognitions: existing?.recognitions ?? 0,
      lastConfidence: existing?.lastConfidence ?? 0,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    await savePersonalSign(sign);
    upsertPersonalSign(sign);
    setWord("");
    setCategory("");
    setPhrase("");
    setNotes("");
    setDraftSamples([]);
    setMessage(`${sign.word} saved with ${sign.samples.length} sample(s).`);
  };

  const deleteSign = async (id: string) => {
    await deletePersonalSign(id);
    removePersonalSign(id);
  };

  const exportSigns = () => {
    const blob = new Blob([JSON.stringify(exportVocabulary(signs), null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "my-signs.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const importSigns = async (file: File) => {
    const text = await file.text();
    const parsed = JSON.parse(text) as PersonalVocabularyExport;
    if (!Array.isArray(parsed.signs)) throw new Error("Invalid vocabulary export.");
    await replacePersonalVocabulary(parsed.signs);
    setPersonalSigns(parsed.signs);
    setMessage(`Imported ${parsed.signs.length} sign(s).`);
  };

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.24)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[var(--text)]">My Signs</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {signs.length} sign(s), {totalSamples} sample(s)
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportSigns}
            disabled={signs.length === 0}
            className="rounded-lg border border-[var(--border)] p-2 text-[var(--muted)] transition hover:text-[var(--text)] disabled:opacity-40"
            title="Export my-signs.json"
          >
            <Download size={15} />
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="rounded-lg border border-[var(--border)] p-2 text-[var(--muted)] transition hover:text-[var(--text)]"
            title="Import my-signs.json"
          >
            <Upload size={15} />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) importSigns(file).catch((err) => setMessage(err instanceof Error ? err.message : "Import failed."));
              event.currentTarget.value = "";
            }}
          />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <input value={word} onChange={(e) => setWord(e.target.value)} placeholder="Word, e.g. Coffee" className="rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]" />
        <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category, e.g. Food" className="rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]" />
        <input value={phrase} onChange={(e) => setPhrase(e.target.value)} placeholder="Optional phrase" className="rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] md:col-span-2" />
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" rows={2} className="resize-none rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] md:col-span-2" />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={captureSample} className="flex items-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--text)] transition hover:border-[var(--accent)]/50">
          <Plus size={15} />
          Record Sample ({draftSamples.length}/5)
        </button>
        <button onClick={saveSign} disabled={!canSave} className="rounded-xl bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-[#0D1117] transition hover:opacity-90 disabled:opacity-40">
          Save Sign
        </button>
        {draftSamples.length > 0 && (
          <button onClick={() => setDraftSamples([])} className="text-xs text-[var(--muted)] transition hover:text-[var(--text)]">
            Clear samples
          </button>
        )}
      </div>

      {message && <p className="mt-3 text-xs text-[var(--muted)]">{message}</p>}

      <div className="mt-5 grid gap-2">
        {signs.length === 0 ? (
          <p className="rounded-xl bg-[var(--bg)] p-4 text-sm text-[var(--muted)]">
            No personal signs yet. Start the camera, enter a word, sign for a few seconds, then record samples.
          </p>
        ) : (
          signs.map((sign) => (
            <div key={sign.id} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-3">
              <div>
                <div className="text-sm font-semibold text-[var(--text)]">{sign.word}</div>
                <div className="mt-1 text-xs text-[var(--muted)]">
                  {sign.samples.length} sample(s) · {sign.category || "Personal"} · {Math.round(sign.lastConfidence * 100)}% last confidence
                </div>
              </div>
              <button onClick={() => deleteSign(sign.id)} className="rounded-lg p-2 text-[var(--muted)] transition hover:bg-[var(--card)] hover:text-[var(--danger)]">
                <Trash2 size={15} />
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
