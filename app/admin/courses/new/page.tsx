"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import AdminShell from "@/components/AdminShell";
import { VOICE_OPTIONS, VOICE_PROVIDER_OPTIONS } from "@/lib/classroom-builder";

export default function NewScormCoursePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const form = new FormData(event.currentTarget);
      const response = await fetch("/api/admin/courses/scorm", {
        method: "POST",
        body: form,
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "The SCORM package could not be uploaded.");

      router.push(`/admin/courses/${payload.course.slug}`);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The SCORM package could not be uploaded.");
    } finally {
      setSaving(false);
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
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-semibold text-[#10283f]">
              Instructor voice
              <select name="voiceProvider" defaultValue="browser" className="mt-2 w-full rounded-xl border border-[#10283f]/15 px-4 py-3">
                {VOICE_PROVIDER_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold text-[#10283f]">
              Voice style
              <select name="voice" defaultValue="onyx" className="mt-2 w-full rounded-xl border border-[#10283f]/15 px-4 py-3">
                {VOICE_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

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
