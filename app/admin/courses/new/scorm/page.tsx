"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  LoaderCircle,
  Package,
  UploadCloud,
} from "lucide-react";
import AdminShell from "@/components/AdminShell";
import { courseThemes } from "@/lib/course-options";
import { createScormCourseFromZip } from "@/lib/scorm-upload-client";
import { maxScormZipMb } from "@/lib/scorm-limits";

function fileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function NewScormCoursePage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedChunks, setUploadedChunks] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);
  const [error, setError] = useState("");

  const uploadPercent = useMemo(() => {
    if (!totalChunks) return 0;
    return Math.round((uploadedChunks / totalChunks) * 100);
  }, [uploadedChunks, totalChunks]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError("Choose a SCORM ZIP package to upload.");
      return;
    }

    setUploading(true);
    setError("");
    setUploadedChunks(0);
    setTotalChunks(0);

    const form = new FormData(event.currentTarget);

    try {
      const result = await createScormCourseFromZip(
        {
          title: String(form.get("title") || ""),
          description: String(form.get("description") || ""),
          audience: String(form.get("audience") || ""),
          theme: String(form.get("theme") || "heritage"),
          estimatedMinutes: Number(form.get("estimatedMinutes")) || 60,
          narrationMode: "package",
          fileName: file.name,
        },
        file,
        (uploaded, total) => {
          setUploadedChunks(uploaded);
          setTotalChunks(total);
        },
      );

      router.push(`/admin/courses/${result.course?.slug}`);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "The SCORM package could not be imported.",
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <AdminShell title="Upload SCORM package" eyebrow="SCORM import">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/admin/courses/new"
          className="inline-flex items-center gap-2 text-sm font-bold text-[#69757e] hover:text-[#10283f]"
        >
          <ArrowLeft size={16} /> Back to course types
        </Link>

        <section className="mt-5 overflow-hidden rounded-[2rem] bg-[#10283f] text-white shadow-xl">
          <div className="grid lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,.8fr)]">
            <div className="px-7 py-9 sm:px-10 sm:py-12">
              <span className="inline-flex items-center gap-2 rounded-full border border-sky-300/25 bg-sky-300/10 px-3 py-1.5 text-xs font-black uppercase tracking-[.16em] text-sky-200">
                <Package size={14} /> SCORM 1.2 and 2004
              </span>
              <h2 className="mt-6 max-w-2xl font-serif text-4xl font-semibold leading-[1.05] tracking-[-.025em] sm:text-5xl">
                Publish an existing SCORM course
              </h2>
              <p className="mt-5 max-w-xl text-base leading-8 text-slate-300">
                Upload a ZIP package from your authoring tool. The course keeps
                its own navigation, media, and interactions while this platform
                handles enrollment, progress, and completion.
              </p>
            </div>
            <div className="border-t border-white/10 bg-white/5 p-7 lg:border-l lg:border-t-0 lg:p-9">
              <p className="text-xs font-black uppercase tracking-[.16em] text-sky-200">
                Works with
              </p>
              <div className="mt-5 space-y-4">
                {[
                  "Articulate Storyline and Rise exports",
                  "Adobe Captivate and iSpring packages",
                  "SCORM 1.2 and SCORM 2004 ZIP files",
                  "Optional narration-script.txt or data-ai-narration markers",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3 text-sm leading-6 text-slate-200">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-sky-300 text-[#10283f]">
                      <Check size={12} strokeWidth={3} />
                    </span>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <form
          onSubmit={handleSubmit}
          className="mt-7 grid min-w-0 gap-7 lg:grid-cols-[minmax(0,1fr)_320px]"
        >
          <div className="min-w-0 space-y-6">
            <section className="rounded-3xl border border-[#10283f]/10 bg-white p-6 shadow-sm sm:p-8">
              <h3 className="font-serif text-2xl font-semibold text-[#10283f]">
                Course details
              </h3>
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <label className="sm:col-span-2">
                  <span className="mb-2 block text-sm font-bold text-[#263746]">
                    Course title
                  </span>
                  <input
                    name="title"
                    required
                    placeholder="Ladder safety for warehouse staff"
                    className="w-full rounded-xl border border-[#10283f]/15 px-4 py-3 outline-none focus:border-[#c68b1b]"
                  />
                </label>
                <label className="sm:col-span-2">
                  <span className="mb-2 block text-sm font-bold text-[#263746]">
                    Description <span className="font-normal text-[#82909a]">(optional)</span>
                  </span>
                  <textarea
                    name="description"
                    rows={4}
                    placeholder="A short summary shown in the course library and enrollment screens."
                    className="w-full resize-y rounded-2xl border border-[#10283f]/15 px-4 py-3 outline-none focus:border-[#c68b1b]"
                  />
                </label>
                <label>
                  <span className="mb-2 block text-sm font-bold text-[#263746]">
                    Learner audience <span className="font-normal text-[#82909a]">(optional)</span>
                  </span>
                  <input
                    name="audience"
                    placeholder="New warehouse associates"
                    className="w-full rounded-xl border border-[#10283f]/15 px-4 py-3 outline-none focus:border-[#c68b1b]"
                  />
                </label>
                <label>
                  <span className="mb-2 block text-sm font-bold text-[#263746]">
                    Estimated duration
                  </span>
                  <select
                    name="estimatedMinutes"
                    defaultValue="60"
                    className="w-full rounded-xl border border-[#10283f]/15 bg-white px-4 py-3"
                  >
                    <option value="15">15 minutes</option>
                    <option value="30">30 minutes</option>
                    <option value="45">45 minutes</option>
                    <option value="60">60 minutes</option>
                    <option value="90">90 minutes</option>
                    <option value="120">2 hours</option>
                  </select>
                </label>
                <label className="sm:col-span-2">
                  <span className="mb-2 block text-sm font-bold text-[#263746]">
                    Visual theme
                  </span>
                  <select
                    name="theme"
                    defaultValue="heritage"
                    className="w-full rounded-xl border border-[#10283f]/15 bg-white px-4 py-3"
                  >
                    {courseThemes.map((theme) => (
                      <option key={theme.id} value={theme.id}>
                        {theme.name} — {theme.description}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </section>

            <section className="rounded-3xl border border-[#10283f]/10 bg-white p-6 shadow-sm sm:p-8">
              <h3 className="font-serif text-2xl font-semibold text-[#10283f]">
                SCORM package
              </h3>
              <label className="mt-6 block cursor-pointer rounded-2xl border-2 border-dashed border-[#10283f]/15 bg-[#f8faf9] px-6 py-8 text-center transition hover:border-[#c68b1b] hover:bg-[#fffaf0]">
                <UploadCloud className="mx-auto text-[#c68b1b]" size={31} />
                <span className="mt-3 block font-bold text-[#10283f]">
                  Choose SCORM ZIP file
                </span>
                <span className="mt-1 block text-xs leading-5 text-[#69757e]">
                  SCORM 1.2 or 2004 · up to {maxScormZipMb()} MB
                </span>
                <input
                  type="file"
                  accept=".zip,application/zip"
                  className="sr-only"
                  onChange={(event) => setFile(event.target.files?.[0] || null)}
                />
              </label>

              {file ? (
                <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl border border-[#10283f]/10 px-4 py-3 text-sm">
                  <span className="min-w-0 truncate font-semibold text-[#263746]">
                    {file.name}
                  </span>
                  <span className="shrink-0 text-xs text-[#7a858c]">
                    {fileSize(file.size)}
                  </span>
                </div>
              ) : (
                <p className="mt-4 text-sm leading-6 text-[#69757e]">
                  The ZIP must include <code className="rounded bg-slate-100 px-1">imsmanifest.xml</code>{" "}
                  and a launchable HTML entry point.
                </p>
              )}
            </section>
          </div>

          <aside className="min-w-0">
            <div className="sticky top-6 space-y-5 rounded-3xl border border-[#10283f]/10 bg-white p-6 shadow-lg">
              <div>
                <p className="text-xs font-black uppercase tracking-[.14em] text-[#477083]">
                  After import
                </p>
                <p className="mt-2 text-sm leading-6 text-[#69757e]">
                  Review the package, edit narration cues if needed, create
                  enrollment codes, and publish when you are ready.
                </p>
              </div>

              {uploading ? (
                <div className="rounded-2xl bg-[#10283f] p-5 text-white">
                  <LoaderCircle className="animate-spin text-sky-300" size={24} />
                  <p className="mt-4 text-xs font-black uppercase tracking-[.14em] text-sky-200">
                    Uploading package
                  </p>
                  <p className="mt-2 font-semibold leading-6">
                    {totalChunks
                      ? `Chunk ${uploadedChunks} of ${totalChunks} (${uploadPercent}%)`
                      : "Preparing upload…"}
                  </p>
                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/15">
                    <div
                      className="h-full rounded-full bg-sky-300 transition-[width] duration-500"
                      style={{ width: `${uploadPercent || 8}%` }}
                    />
                  </div>
                </div>
              ) : null}

              {error ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold leading-6 text-red-800">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={uploading || !file}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#10283f] px-5 py-4 font-black text-white shadow-sm transition hover:bg-[#0d2033] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {uploading ? (
                  <LoaderCircle className="animate-spin" size={18} />
                ) : (
                  <Package size={18} />
                )}
                {uploading ? "Importing SCORM…" : "Import SCORM package"}
              </button>
            </div>
          </aside>
        </form>
      </div>
    </AdminShell>
  );
}
