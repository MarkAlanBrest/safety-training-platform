"use client";

import { useMemo, useState } from "react";
import { Download, LoaderCircle, Mic } from "lucide-react";
import AdminShell from "@/components/AdminShell";
import { VOICE_OPTIONS } from "@/lib/classroom-builder";
import { parseSlideNarrationDocument } from "@/lib/slide-narration-batch";

const EXAMPLE = `Slide 1
Welcome to ladder safety. Today we will cover inspection, setup, and safe climbing.

Slide 2
Before you climb, inspect the feet, rungs, and spreaders. Look for cracks, bends, or missing parts.

Slide 3
Set the ladder at the correct angle — about one foot out for every four feet up.`;

export default function SlideNarrationPage() {
  const [document, setDocument] = useState("");
  const [voice, setVoice] = useState("cedar");
  const [speed, setSpeed] = useState("0.96");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const preview = useMemo(() => parseSlideNarrationDocument(document), [document]);

  async function generateZip() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/slide-narration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document, voice, speed: Number(speed) }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || "Could not generate slide audio.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = "slide-narration.zip";
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate slide audio.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell
      eyebrow="Audio tools"
      title="Slide narration"
      actions={
        <button
          type="button"
          onClick={() => void generateZip()}
          disabled={busy || !preview.length}
          className="inline-flex items-center gap-2 rounded-xl bg-[#10283f] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {busy ? <LoaderCircle size={16} className="animate-spin" /> : <Download size={16} />}
          {busy ? "Generating…" : "Download ZIP"}
        </button>
      }
    >
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-100 text-amber-800">
              <Mic size={20} />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Paste your script</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Use a heading for each slide: <code className="rounded bg-slate-100 px-1">Slide 1</code>,{" "}
                <code className="rounded bg-slate-100 px-1">Slide 2</code>, and so on. Everything under
                that heading becomes one MP3 file.
              </p>
            </div>
          </div>

          <textarea
            value={document}
            onChange={(event) => setDocument(event.target.value)}
            rows={18}
            placeholder={EXAMPLE}
            className="mt-5 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm leading-7 text-slate-800 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
          />

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-slate-700">
              Voice
              <select
                value={voice}
                onChange={(event) => setVoice(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              >
                {VOICE_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Speed
              <input
                type="number"
                min="0.75"
                max="1.25"
                step="0.01"
                value={speed}
                onChange={(event) => setSpeed(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              />
            </label>
          </div>

          {error ? (
            <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          ) : null}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Preview</h2>
          <p className="mt-1 text-sm text-slate-600">
            {preview.length
              ? `${preview.length} audio file${preview.length === 1 ? "" : "s"} will be created.`
              : "Add Slide headings to split your document."}
          </p>

          <div className="mt-4 space-y-3">
            {preview.map((slide) => (
              <div key={`${slide.slideNumber}-${slide.text.slice(0, 24)}`} className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-[.14em] text-slate-500">
                  Slide {slide.slideNumber} → slide-{String(slide.slideNumber).padStart(2, "0")}.mp3
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  {slide.text.length > 220 ? `${slide.text.slice(0, 220).trim()}…` : slide.text}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-950">
            <p className="font-semibold">Workflow</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>Generate and download the ZIP here.</li>
              <li>Insert each MP3 into the matching PowerPoint slide.</li>
              <li>Put only AI question cues in speaker notes.</li>
            </ol>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
