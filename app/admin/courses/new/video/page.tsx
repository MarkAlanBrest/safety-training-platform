"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  LoaderCircle,
  PlayCircle,
} from "lucide-react";
import AdminShell from "@/components/AdminShell";
import VideoCueBuilder from "@/components/video/VideoCueBuilder";
import { courseThemes } from "@/lib/course-options";
import { parseJsonResponse } from "@/lib/parse-response";
import { emptyVideoCue, parseYouTubeUrl, type VideoCue } from "@/lib/video";

export default function NewVideoCoursePage() {
  const router = useRouter();
  const [videoUrl, setVideoUrl] = useState("");
  const [cues, setCues] = useState<VideoCue[]>([emptyVideoCue(45), emptyVideoCue(120)]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const parsedVideo = useMemo(() => parseYouTubeUrl(videoUrl), [videoUrl]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!parsedVideo) {
      setError("Enter a valid YouTube video URL.");
      return;
    }

    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/admin/courses/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: String(form.get("title") || ""),
          description: String(form.get("description") || ""),
          audience: String(form.get("audience") || ""),
          theme: String(form.get("theme") || "heritage"),
          estimatedMinutes: Number(form.get("estimatedMinutes")) || 30,
          videoUrl: parsedVideo.url,
          cues,
        }),
      });
      const payload = await parseJsonResponse<{ course?: { slug: string }; error?: string }>(response);
      if (!response.ok || !payload.course?.slug) {
        throw new Error(payload.error || "The video course could not be created.");
      }
      router.push(`/admin/courses/${payload.course.slug}/video`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The video course could not be created.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell title="Create video course" eyebrow="Video lesson">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/admin/courses/new"
          className="inline-flex items-center gap-2 text-sm font-bold text-[#69757e] hover:text-[#10283f]"
        >
          <ArrowLeft size={16} /> Back to course types
        </Link>

        <section className="mt-5 overflow-hidden rounded-[2rem] bg-[#10283f] text-white shadow-xl">
          <div className="px-7 py-9 sm:px-10 sm:py-12">
            <span className="inline-flex items-center gap-2 rounded-full border border-rose-300/25 bg-rose-300/10 px-3 py-1.5 text-xs font-black uppercase tracking-[.16em] text-rose-200">
              <PlayCircle size={14} /> YouTube video lesson
            </span>
            <h2 className="mt-6 max-w-2xl font-serif text-4xl font-semibold leading-[1.05]">
              Link a video and add stopping points
            </h2>
            <p className="mt-5 max-w-xl text-base leading-8 text-slate-300">
              Learners watch the video full-screen. At each timestamp you choose, playback pauses for a knowledge check or activity before they can continue.
            </p>
          </div>
        </section>

        <form onSubmit={handleSubmit} className="mt-7 space-y-6">
          <section className="rounded-3xl border border-[#10283f]/10 bg-white p-6 shadow-sm sm:p-8">
            <h3 className="font-serif text-2xl font-semibold text-[#10283f]">Course details</h3>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="mb-2 block text-sm font-bold text-[#263746]">Course title</span>
                <input name="title" required className="w-full rounded-xl border border-[#10283f]/15 px-4 py-3" />
              </label>
              <label className="sm:col-span-2">
                <span className="mb-2 block text-sm font-bold text-[#263746]">Description</span>
                <textarea name="description" rows={3} className="w-full rounded-2xl border border-[#10283f]/15 px-4 py-3" />
              </label>
              <label>
                <span className="mb-2 block text-sm font-bold text-[#263746]">Audience</span>
                <input name="audience" className="w-full rounded-xl border border-[#10283f]/15 px-4 py-3" />
              </label>
              <label>
                <span className="mb-2 block text-sm font-bold text-[#263746]">Estimated duration</span>
                <select name="estimatedMinutes" defaultValue="30" className="w-full rounded-xl border border-[#10283f]/15 bg-white px-4 py-3">
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="45">45 minutes</option>
                  <option value="60">60 minutes</option>
                </select>
              </label>
              <label className="sm:col-span-2">
                <span className="mb-2 block text-sm font-bold text-[#263746]">Theme</span>
                <select name="theme" defaultValue="heritage" className="w-full rounded-xl border border-[#10283f]/15 bg-white px-4 py-3">
                  {courseThemes.map((theme) => (
                    <option key={theme.id} value={theme.id}>{theme.name}</option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="rounded-3xl border border-[#10283f]/10 bg-white p-6 shadow-sm sm:p-8">
            <h3 className="font-serif text-2xl font-semibold text-[#10283f]">YouTube video</h3>
            <label className="mt-5 block">
              <span className="mb-2 block text-sm font-bold text-[#263746]">Video URL</span>
              <input
                value={videoUrl}
                onChange={(event) => setVideoUrl(event.target.value)}
                placeholder="https://www.youtube.com/watch?v=jS98qJQHzaY"
                className="w-full rounded-xl border border-[#10283f]/15 px-4 py-3"
                required
              />
            </label>
            {parsedVideo ? (
              <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-emerald-700">
                <Check size={16} /> YouTube video detected ({parsedVideo.videoId})
              </div>
            ) : videoUrl ? (
              <p className="mt-4 text-sm font-semibold text-red-700">Enter a valid YouTube watch, embed, or shorts URL.</p>
            ) : null}
          </section>

          <section className="rounded-3xl border border-[#10283f]/10 bg-white p-6 shadow-sm sm:p-8">
            <h3 className="font-serif text-2xl font-semibold text-[#10283f]">Stopping points</h3>
            <p className="mt-2 text-sm leading-6 text-[#69757e]">
              Add interactions at specific timestamps. The video pauses until the learner completes each required check.
            </p>
            <div className="mt-6">
              <VideoCueBuilder cues={cues} onChange={setCues} />
            </div>
          </section>

          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={saving || !parsedVideo}
            className="inline-flex items-center gap-2 rounded-xl bg-[#10283f] px-6 py-4 font-black text-white disabled:opacity-60"
          >
            {saving ? <LoaderCircle className="animate-spin" size={18} /> : <PlayCircle size={18} />}
            {saving ? "Creating video course…" : "Create video course"}
          </button>
        </form>
      </div>
    </AdminShell>
  );
}
