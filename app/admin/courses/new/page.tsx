"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import AdminShell from "@/components/AdminShell";
import { VOICE_OPTIONS, VOICE_PROVIDER_OPTIONS } from "@/lib/classroom-builder";
import {
  createScormCourseFromZip,
  MAX_SCORM_ZIP_BYTES,
} from "@/lib/scorm-upload-client";

export default function NewScormCoursePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [narrationMode, setNarrationMode] = useState<"package" | "premium" | "browser">("package");
  const [selectedVoice, setSelectedVoice] = useState("cedar");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setProgress("");

    try {
      const form = new FormData(event.currentTarget);
      const file = form.get("scorm");
      if (!(file instanceof File)) {
        throw new Error("Choose a SCORM ZIP package to upload.");
      }

      const payload = await createScormCourseFromZip(
        {
          title: String(form.get("title") || ""),
          description: String(form.get("description") || ""),
          theme: String(form.get("theme") || "heritage"),
          narrationMode,
          voiceProvider: narrationMode === "browser" ? "browser" : "premium",
          voice: narrationMode === "browser" ? "mark" : selectedVoice,
          fileName: file.name,
        },
        file,
        (uploaded, total) => {
          setProgress(`Uploading package… ${uploaded}/${total}`);
        },
      );

      router.push(`/admin/courses/${payload.course?.slug}`);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The SCORM package could not be uploaded.");
    } finally {
      setSaving(false);
      setProgress("");
    }
  }

  return (
    <AdminShell title="Upload SCORM course" eyebrow="New course">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 rounded-3xl border border-[#10283f]/10 bg-[#10283f] px-6 py-5 text-white">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[#e8c273]">SCORM + AI instructor</p>
          <p className="mt-2 text-sm leading-7 text-white/80">
            Upload a SCORM package for the lesson content. Learners get your SCORM player on the
            left, with AI narration and chat on the right using browser or premium voice.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 rounded-3xl border border-[#10283f]/10 bg-white p-6 shadow-sm">
          <label className="block text-sm font-semibold text-[#10283f]">
            Course title
            <input
              name="title"
              required
              className="mt-2 w-full rounded-xl border border-[#10283f]/15 px-4 py-3"
              placeholder="Fall Protection Refresher"
            />
          </label>

          <label className="block text-sm font-semibold text-[#10283f]">
            Description
            <textarea
              name="description"
              rows={3}
              className="mt-2 w-full rounded-xl border border-[#10283f]/15 px-4 py-3"
              placeholder="Optional welcome message and course summary for the AI instructor."
            />
          </label>

          <label className="block text-sm font-semibold text-[#10283f]">
            SCORM package (.zip)
            <input
              name="scorm"
              type="file"
              accept=".zip,application/zip"
              required
              className="mt-2 block w-full text-sm"
            />
            <p className="mt-1 text-xs text-[#69757e]">
              Maximum upload size: {Math.floor(MAX_SCORM_ZIP_BYTES / (1024 * 1024))} MB. Large packages upload in chunks automatically.
            </p>
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-semibold text-[#10283f]">
              Narration mode
              <select
                name="narrationMode"
                value={narrationMode}
                onChange={(event) => setNarrationMode(event.target.value as typeof narrationMode)}
                className="mt-2 w-full rounded-xl border border-[#10283f]/15 px-4 py-3"
              >
                <option value="package">Package audio only (recommended)</option>
                {VOICE_PROVIDER_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              <span className="mt-2 block text-xs leading-5 text-[#69757e]">
                Choose package audio when the SCORM lesson already has narration. This prevents two voices.
              </span>
            </label>
            <label className="block text-sm font-semibold text-[#10283f]">
              Voice style
              <select
                name="voice"
                value={narrationMode === "browser" ? "mark" : selectedVoice}
                onChange={(event) => setSelectedVoice(event.target.value)}
                disabled={narrationMode !== "premium"}
                className="mt-2 w-full rounded-xl border border-[#10283f]/15 px-4 py-3 disabled:bg-slate-100 disabled:text-slate-500"
              >
                {narrationMode === "browser" ? <option value="mark">Mark (device voice)</option> : null}
                {VOICE_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              <span className="mt-2 block text-xs leading-5 text-[#69757e]">
                {narrationMode === "premium"
                  ? `The course will use ${VOICE_OPTIONS.find((option) => option.id === selectedVoice)?.label || selectedVoice}.`
                  : narrationMode === "browser"
                    ? "Free narration uses Mark when installed, or the learner's English system voice. Premium voice names are not available in browser mode."
                    : "The voice is supplied by the SCORM package."}
              </span>
            </label>
          </div>

          {progress ? <p className="text-sm font-semibold text-[#69757e]">{progress}</p> : null}
          {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-[#c68b1b] px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {saving ? <LoaderCircle className="animate-spin" size={16} /> : null}
            {saving ? "Uploading…" : "Upload SCORM course"}
          </button>
        </form>
      </div>
    </AdminShell>
  );
}
