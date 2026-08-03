"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { LoaderCircle, UploadCloud } from "lucide-react";
import AdminShell from "@/components/AdminShell";
import { parseJsonResponse } from "@/lib/parse-response";

export default function NewClassroomPage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    previewUrl: string;
    adminUrl: string;
    slideCount: number;
    course: { title: string; slug: string };
  } | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!file || !title.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const form = new FormData();
      form.set("title", title.trim());
      form.set("description", description.trim());
      form.set("pptx", file);
      const response = await fetch("/api/classroom/upload", {
        method: "POST",
        body: form,
      });
      const data = await parseJsonResponse<{
        error?: string;
        previewUrl: string;
        adminUrl: string;
        slideCount: number;
        course: { title: string; slug: string };
      }>(response);
      if (!response.ok) throw new Error(data.error || "Upload failed.");
      setResult(data);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : "Upload failed.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AdminShell
      title="New AI Classroom"
      eyebrow="Upload a PowerPoint deck and let the AI instructor teach from it."
    >
      <div className="mx-auto max-w-3xl">
        <form
          onSubmit={onSubmit}
          className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm"
        >
          <label className="block text-sm font-semibold text-slate-700">
            Course title
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-amber-400"
              placeholder="Forklift Safety Classroom"
              required
            />
          </label>

          <label className="mt-5 block text-sm font-semibold text-slate-700">
            Description
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="mt-2 min-h-24 w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-amber-400"
              placeholder="Optional short description for admins."
            />
          </label>

          <label className="mt-5 block text-sm font-semibold text-slate-700">
            PowerPoint file (.pptx)
            <div className="mt-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
              <UploadCloud className="mx-auto text-slate-400" size={28} />
              <input
                type="file"
                accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
                className="mt-4 block w-full text-sm text-slate-600"
                required
              />
              {file ? (
                <p className="mt-2 text-sm font-medium text-slate-700">{file.name}</p>
              ) : null}
            </div>
          </label>

          {error ? (
            <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting || !file || !title.trim()}
            className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-[#0f2b46] px-5 py-3 font-semibold text-white disabled:opacity-40"
          >
            {submitting ? <LoaderCircle className="animate-spin" size={18} /> : null}
            Create classroom
          </button>
        </form>

        {result ? (
          <div className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-50 p-6">
            <p className="font-bold text-emerald-900">
              {result.course.title} is ready ({result.slideCount} slides imported).
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href={result.previewUrl}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
              >
                Open classroom preview
              </Link>
              <Link
                href={result.adminUrl}
                className="rounded-xl border border-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-900"
              >
                Manage course
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    </AdminShell>
  );
}
