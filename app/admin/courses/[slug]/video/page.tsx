"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, LoaderCircle, Save } from "lucide-react";
import AdminShell from "@/components/AdminShell";
import VideoCueBuilder from "@/components/video/VideoCueBuilder";
import { learnerCoursePath } from "@/lib/course-routes";
import { parseJsonResponse } from "@/lib/parse-response";
import { parseYouTubeUrl, type VideoPlan } from "@/lib/video";

export default function EditVideoCoursePage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = params?.slug;
  const [plan, setPlan] = useState<VideoPlan | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/admin/courses/${slug}/video-plan`, { cache: "no-store" })
      .then(async (response) => {
        const data = await parseJsonResponse<{ plan?: VideoPlan; error?: string }>(response);
        if (!response.ok || !data.plan) throw new Error(data.error || "Video plan could not be loaded.");
        setPlan(data.plan);
        setVideoUrl(data.plan.source.url);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Video plan could not be loaded."))
      .finally(() => setLoading(false));
  }, [slug]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!slug || !plan) return;
    const parsed = parseYouTubeUrl(videoUrl);
    if (!parsed) {
      setError("Enter a valid YouTube video URL.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    const form = new FormData(event.currentTarget);
    const nextPlan: VideoPlan = {
      ...plan,
      title: String(form.get("title") || plan.title),
      opening: String(form.get("opening") || plan.opening),
      source: parsed,
      cues: plan.cues,
    };

    try {
      const response = await fetch(`/api/admin/courses/${slug}/video-plan`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: nextPlan, title: nextPlan.title }),
      });
      const payload = await parseJsonResponse<{ plan?: VideoPlan; error?: string }>(response);
      if (!response.ok || !payload.plan) {
        throw new Error(payload.error || "The video plan could not be saved.");
      }
      setPlan(payload.plan);
      setMessage("Video plan saved.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The video plan could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell title="Edit video lesson" eyebrow="Video course">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center gap-3">
          <Link href={`/admin/courses/${slug}`} className="inline-flex items-center gap-2 text-sm font-bold text-[#69757e]">
            <ArrowLeft size={16} /> Back to course
          </Link>
          {slug ? (
            <Link
              href={`${learnerCoursePath(slug, "video")}?preview=1`}
              target="_blank"
              className="text-sm font-bold text-[#10283f]"
            >
              Preview learner view
            </Link>
          ) : null}
        </div>

        {loading ? (
          <div className="mt-10 grid min-h-40 place-items-center">
            <LoaderCircle className="animate-spin text-[#a06e16]" size={30} />
          </div>
        ) : error && !plan ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
            {error}
          </div>
        ) : plan ? (
          <form onSubmit={handleSubmit} className="mt-6 space-y-6">
            <section className="rounded-3xl border border-[#10283f]/10 bg-white p-6 shadow-sm sm:p-8">
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="sm:col-span-2">
                  <span className="mb-2 block text-sm font-bold">Lesson title</span>
                  <input name="title" defaultValue={plan.title} className="w-full rounded-xl border border-[#10283f]/15 px-4 py-3" />
                </label>
                <label className="sm:col-span-2">
                  <span className="mb-2 block text-sm font-bold">Opening message</span>
                  <textarea name="opening" defaultValue={plan.opening} rows={3} className="w-full rounded-2xl border border-[#10283f]/15 px-4 py-3" />
                </label>
                <label className="sm:col-span-2">
                  <span className="mb-2 block text-sm font-bold">YouTube URL</span>
                  <input value={videoUrl} onChange={(event) => setVideoUrl(event.target.value)} className="w-full rounded-xl border border-[#10283f]/15 px-4 py-3" />
                </label>
              </div>
            </section>

            <section className="rounded-3xl border border-[#10283f]/10 bg-white p-6 shadow-sm sm:p-8">
              <VideoCueBuilder cues={plan.cues} onChange={(cues) => setPlan({ ...plan, cues })} />
            </section>

            {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{message}</div> : null}
            {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">{error}</div> : null}

            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-[#10283f] px-6 py-4 font-black text-white disabled:opacity-60">
              {saving ? <LoaderCircle className="animate-spin" size={18} /> : <Save size={18} />}
              Save video plan
            </button>
          </form>
        ) : null}
      </div>
    </AdminShell>
  );
}
