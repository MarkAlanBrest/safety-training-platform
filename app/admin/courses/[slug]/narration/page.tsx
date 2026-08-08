"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  ClipboardPaste,
  LoaderCircle,
  MapPin,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import AdminShell from "@/components/AdminShell";
import ScormPlayer, { type ScormRuntimeChange } from "@/components/ScormPlayer";
import {
  scormLocationFromRuntime,
  type ScormNarrationCue,
} from "@/lib/scorm-instructor";
import {
  formatScormNarrationDocument,
  parseScormNarrationDocument,
} from "@/lib/scorm-narration-document";
import { parseJsonResponse } from "@/lib/parse-response";

type NarrationPayload = {
  title: string;
  slug: string;
  scormVersion: string;
  scormEntryPoint: string;
  opening: string;
  scormNarration: ScormNarrationCue[];
};

const BULK_EXAMPLE = `=== 1 ===
Welcome to ladder safety.

=== page-2 ===
Inspect the feet and rungs before climbing.`;

export default function ScormNarrationEditorPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [course, setCourse] = useState<NarrationPayload | null>(null);
  const [opening, setOpening] = useState("");
  const [cues, setCues] = useState<ScormNarrationCue[]>([]);
  const [currentLocation, setCurrentLocation] = useState("");
  const [bulkDocument, setBulkDocument] = useState("");
  const [showBulk, setShowBulk] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    fetch(`/api/admin/courses/${encodeURIComponent(slug)}/scorm-narration`)
      .then(async (response) => {
        const payload = await parseJsonResponse<NarrationPayload & { error?: string }>(response);
        if (!response.ok) throw new Error(payload.error || "Could not load narration script.");
        if (!active) return;
        setCourse(payload);
        setOpening(payload.opening || "");
        setCues(payload.scormNarration || []);
      })
      .catch((reason) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : "Could not load narration script.");
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [slug]);

  const onRuntimeChange = useCallback((change: ScormRuntimeChange) => {
    const location = scormLocationFromRuntime(change.snapshot);
    if (location) setCurrentLocation(location);
  }, []);

  const bulkPreview = useMemo(
    () => parseScormNarrationDocument(bulkDocument),
    [bulkDocument],
  );

  function addCue(location = currentLocation) {
    setCues((current) => [...current, { location: location.trim(), text: "" }]);
    setSaved(false);
  }

  function updateCue(index: number, patch: Partial<ScormNarrationCue>) {
    setCues((current) =>
      current.map((cue, cueIndex) => (cueIndex === index ? { ...cue, ...patch } : cue)),
    );
    setSaved(false);
  }

  function removeCue(index: number) {
    setCues((current) => current.filter((_, cueIndex) => cueIndex !== index));
    setSaved(false);
  }

  function applyBulkImport() {
    const imported = parseScormNarrationDocument(bulkDocument);
    if (!imported.length) return;
    setCues(imported);
    setShowBulk(false);
    setSaved(false);
  }

  function exportBulk() {
    setBulkDocument(formatScormNarrationDocument(cues));
    setShowBulk(true);
  }

  async function save() {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const response = await fetch(
        `/api/admin/courses/${encodeURIComponent(slug)}/scorm-narration`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ opening, scormNarration: cues }),
        },
      );
      const payload = await parseJsonResponse<{
        opening?: string;
        scormNarration?: ScormNarrationCue[];
        error?: string;
      }>(response);
      if (!response.ok) throw new Error(payload.error || "Could not save narration script.");
      setOpening(payload.opening || opening);
      setCues(payload.scormNarration || cues);
      setSaved(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save narration script.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AdminShell eyebrow="SCORM instructor" title="Narration script">
        <div className="grid min-h-[50vh] place-items-center">
          <LoaderCircle className="animate-spin text-[#c68b1b]" size={34} />
        </div>
      </AdminShell>
    );
  }

  if (!course) {
    return (
      <AdminShell eyebrow="SCORM instructor" title="Narration script">
        <p className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {error || "SCORM course not found."}
        </p>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      eyebrow="SCORM instructor"
      title={`Narration script · ${course.title}`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/admin/courses/${course.slug}`}
            className="inline-flex items-center gap-2 rounded-xl border border-[#10283f]/15 px-4 py-2.5 text-sm font-bold text-[#10283f]"
          >
            <ArrowLeft size={16} /> Back to course
          </Link>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-[#10283f] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {saving ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? "Saving…" : saved ? "Saved" : "Save script"}
          </button>
        </div>
      }
    >
      <div className="mx-auto grid max-w-[1400px] gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <section className="flex min-h-[520px] flex-col overflow-hidden rounded-3xl border border-[#10283f]/10 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#10283f]/10 px-5 py-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[.17em] text-[#9a6812]">
                SCORM preview
              </p>
              <p className="mt-1 text-sm text-[#69757e]">
                Navigate the package to capture location values for each narration cue.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-xl bg-[#f4f7f9] px-3 py-2 text-sm">
              <MapPin size={15} className="text-[#c68b1b]" />
              <span className="font-semibold text-[#10283f]">
                {currentLocation || "No location yet"}
              </span>
            </div>
          </div>
          <div className="min-h-0 flex-1">
            <ScormPlayer
              preview
              embedded
              title={course.title}
              slug={course.slug}
              entryPoint={course.scormEntryPoint}
              version={course.scormVersion}
              onRuntimeChange={onRuntimeChange}
              className="h-full min-h-[420px]"
            />
          </div>
        </section>

        <div className="space-y-6">
          <section className="rounded-3xl border border-[#10283f]/10 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-[#10283f]">Opening script</h2>
            <p className="mt-1 text-sm leading-6 text-[#69757e]">
              Spoken and shown in the instructor chat when the learner starts the course.
            </p>
            <textarea
              value={opening}
              onChange={(event) => {
                setOpening(event.target.value);
                setSaved(false);
              }}
              rows={4}
              className="mt-4 w-full rounded-2xl border border-[#10283f]/15 px-4 py-3 text-sm leading-7 text-[#10283f] outline-none focus:border-[#c68b1b] focus:ring-2 focus:ring-amber-200"
              placeholder="Welcome to the course…"
            />
          </section>

          <section className="rounded-3xl border border-[#10283f]/10 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-[#10283f]">Location cues</h2>
                <p className="mt-1 text-sm leading-6 text-[#69757e]">
                  Match each SCORM location to the narration the AI instructor should speak.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => exportBulk()}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#10283f]/15 px-3 py-2 text-xs font-bold text-[#10283f]"
                >
                  <ClipboardPaste size={14} /> Bulk edit
                </button>
                <button
                  type="button"
                  onClick={() => addCue()}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#f4f7f9] px-3 py-2 text-xs font-bold text-[#10283f]"
                >
                  <Plus size={14} /> Add cue
                </button>
              </div>
            </div>

            {showBulk ? (
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-950">Bulk script</p>
                <p className="mt-1 text-xs leading-6 text-amber-900">
                  Use <code className="rounded bg-white/70 px-1">=== location ===</code> headers, or
                  lines like <code className="rounded bg-white/70 px-1">location: page-2</code>.
                </p>
                <textarea
                  value={bulkDocument}
                  onChange={(event) => setBulkDocument(event.target.value)}
                  rows={10}
                  placeholder={BULK_EXAMPLE}
                  className="mt-3 w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm leading-6 text-[#10283f]"
                />
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={applyBulkImport}
                    disabled={!bulkPreview.length}
                    className="rounded-xl bg-[#10283f] px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                  >
                    Import {bulkPreview.length ? `${bulkPreview.length} cue${bulkPreview.length === 1 ? "" : "s"}` : ""}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowBulk(false)}
                    className="rounded-xl border border-amber-300 px-4 py-2 text-xs font-bold text-amber-950"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}

            <div className="mt-5 space-y-4">
              {cues.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#10283f]/15 bg-[#f8fafb] px-5 py-8 text-center">
                  <p className="text-sm text-[#69757e]">
                    No cues yet. Navigate the SCORM preview, then add a cue for the current location.
                  </p>
                  <button
                    type="button"
                    onClick={() => addCue()}
                    disabled={!currentLocation}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#10283f] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40"
                  >
                    <MapPin size={15} /> Use location &ldquo;{currentLocation || "…"}&rdquo;
                  </button>
                </div>
              ) : (
                cues.map((cue, index) => (
                  <article
                    key={`${index}-${cue.location}`}
                    className="rounded-2xl border border-[#10283f]/10 bg-[#f8fafb] p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="min-w-0 flex-1 text-xs font-bold uppercase tracking-[.14em] text-[#9a6812]">
                        Location
                        <input
                          value={cue.location}
                          onChange={(event) => updateCue(index, { location: event.target.value })}
                          placeholder="e.g. 1 or page-2"
                          className="mt-1 w-full rounded-xl border border-[#10283f]/15 bg-white px-3 py-2 text-sm font-semibold normal-case tracking-normal text-[#10283f]"
                        />
                      </label>
                      {currentLocation ? (
                        <button
                          type="button"
                          onClick={() => updateCue(index, { location: currentLocation })}
                          className="mt-5 rounded-lg border border-[#10283f]/15 px-3 py-2 text-xs font-bold text-[#10283f]"
                        >
                          Use &ldquo;{currentLocation}&rdquo;
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => removeCue(index)}
                        className="mt-5 grid h-9 w-9 place-items-center rounded-lg border border-red-200 text-red-700"
                        aria-label="Remove cue"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <label className="mt-3 block text-xs font-bold uppercase tracking-[.14em] text-[#9a6812]">
                      Narration
                      <textarea
                        value={cue.text}
                        onChange={(event) => updateCue(index, { text: event.target.value })}
                        rows={3}
                        placeholder="What the instructor should say at this location…"
                        className="mt-1 w-full rounded-xl border border-[#10283f]/15 bg-white px-3 py-2 text-sm leading-6 font-normal normal-case tracking-normal text-[#10283f]"
                      />
                    </label>
                  </article>
                ))
              )}
            </div>
          </section>

          {error ? (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </AdminShell>
  );
}
