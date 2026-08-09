"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpenCheck,
  BrainCircuit,
  Check,
  FileText,
  LoaderCircle,
  Palette,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import AdminShell from "@/components/AdminShell";
import { parseJsonResponse } from "@/lib/parse-response";

const buildStages = [
  "Reading your brief and source material",
  "Designing the course structure",
  "Writing lessons and realistic examples",
  "Creating activities and assessments",
  "Polishing the editable draft",
];

function fileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function NewAiCoursePage() {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [building, setBuilding] = useState(false);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState("");

  const totalBytes = useMemo(() => files.reduce((total, file) => total + file.size, 0), [files]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBuilding(true);
    setStage(0);
    setError("");

    const timer = window.setInterval(() => {
      setStage((current) => Math.min(buildStages.length - 1, current + 1));
    }, 9000);

    try {
      const form = new FormData(event.currentTarget);
      form.delete("sources");
      files.forEach((file) => form.append("sources", file, file.name));
      const response = await fetch("/api/admin/courses/generate", { method: "POST", body: form });
      const payload = await parseJsonResponse<{ adminUrl?: string; error?: string }>(response);
      if (!response.ok || !payload.adminUrl) {
        throw new Error(payload.error || "The course draft could not be generated.");
      }
      router.push(payload.adminUrl);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The course draft could not be generated.");
      setBuilding(false);
    } finally {
      window.clearInterval(timer);
    }
  }

  return (
    <AdminShell title="Create a course with AI" eyebrow="AI course studio">
      <div className="mx-auto max-w-6xl">
        <section className="overflow-hidden rounded-[2rem] bg-[#10283f] text-white shadow-xl">
          <div className="grid lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,.75fr)]">
            <div className="px-7 py-9 sm:px-10 sm:py-12">
              <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1.5 text-xs font-black uppercase tracking-[.16em] text-amber-200">
                <Sparkles size={14} /> From idea to editable course
              </span>
              <h2 className="mt-6 max-w-3xl font-serif text-4xl font-semibold leading-[1.05] tracking-[-.025em] sm:text-5xl">
                Describe what people need to learn. AI builds the course.
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
                Start with a plain-language request. Add policies, manuals, presentations, or reference documents when you have them. You will receive a professional native course that remains fully editable.
              </p>
            </div>
            <div className="border-t border-white/10 bg-white/5 p-7 lg:border-l lg:border-t-0 lg:p-9">
              <p className="text-xs font-black uppercase tracking-[.16em] text-amber-200">AI creates</p>
              <div className="mt-5 space-y-4">
                {[
                  "A coherent chapter outline",
                  "Publication-ready teaching content",
                  "Scenarios and interactive activities",
                  "Knowledge checks and a final assessment",
                  "A responsive learner experience",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3 text-sm leading-6 text-slate-200">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-amber-300 text-[#10283f]">
                      <Check size={12} strokeWidth={3} />
                    </span>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <form onSubmit={handleSubmit} className="mt-7 grid min-w-0 gap-7 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-6">
            <section className="rounded-3xl border border-[#10283f]/10 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#fff3d7] text-[#9a6812]">
                  <BrainCircuit size={21} />
                </span>
                <div>
                  <p className="text-xs font-black uppercase tracking-[.15em] text-[#9a6812]">Course brief</p>
                  <h3 className="font-serif text-2xl font-semibold text-[#10283f]">What should this course accomplish?</h3>
                </div>
              </div>

              <label className="mt-7 block">
                <span className="mb-2 block text-sm font-bold text-[#263746]">Describe the course</span>
                <textarea
                  name="brief"
                  required
                  minLength={20}
                  rows={9}
                  placeholder="Create a practical lockout/tagout course for newly hired maintenance technicians. Teach when LOTO is required, the authorized employee procedure, group lockout responsibilities, and common mistakes. Use realistic manufacturing scenarios and require an 80% final score."
                  className="w-full resize-y rounded-2xl border border-[#10283f]/15 px-5 py-4 text-base leading-7 outline-none transition focus:border-[#c68b1b] focus:ring-4 focus:ring-[#e8c273]/20"
                />
                <span className="mt-2 block text-xs leading-5 text-[#69757e]">
                  Include the desired outcome, important topics, real-world context, and anything AI must not assume.
                </span>
              </label>

              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <label>
                  <span className="mb-2 block text-sm font-bold text-[#263746]">Course title <span className="font-normal text-[#82909a]">(optional)</span></span>
                  <input name="title" placeholder="Let AI choose" className="w-full rounded-xl border border-[#10283f]/15 px-4 py-3 outline-none focus:border-[#c68b1b]" />
                </label>
                <label>
                  <span className="mb-2 block text-sm font-bold text-[#263746]">Learner audience <span className="font-normal text-[#82909a]">(optional)</span></span>
                  <input name="audience" placeholder="New maintenance technicians" className="w-full rounded-xl border border-[#10283f]/15 px-4 py-3 outline-none focus:border-[#c68b1b]" />
                </label>
                <label>
                  <span className="mb-2 block text-sm font-bold text-[#263746]">Target duration</span>
                  <select name="estimatedMinutes" defaultValue="30" className="w-full rounded-xl border border-[#10283f]/15 bg-white px-4 py-3">
                    <option value="15">15 minutes · Microlearning</option>
                    <option value="30">30 minutes · Focused course</option>
                    <option value="45">45 minutes · Standard course</option>
                    <option value="60">60 minutes · In-depth course</option>
                    <option value="90">90 minutes · Comprehensive course</option>
                  </select>
                </label>
                <label>
                  <span className="mb-2 block text-sm font-bold text-[#263746]">Mastery questions</span>
                  <select name="questionCount" defaultValue="8" className="w-full rounded-xl border border-[#10283f]/15 bg-white px-4 py-3">
                    <option value="5">5 questions</option>
                    <option value="8">8 questions</option>
                    <option value="10">10 questions</option>
                    <option value="15">15 questions</option>
                    <option value="20">20 questions</option>
                  </select>
                </label>
              </div>
            </section>

            <section className="rounded-3xl border border-[#10283f]/10 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#e7f2f5] text-[#24546b]">
                  <UploadCloud size={21} />
                </span>
                <div>
                  <p className="text-xs font-black uppercase tracking-[.15em] text-[#477083]">Supporting material</p>
                  <h3 className="font-serif text-2xl font-semibold text-[#10283f]">Give AI reliable source material</h3>
                </div>
              </div>

              <label className="mt-7 block cursor-pointer rounded-2xl border-2 border-dashed border-[#10283f]/15 bg-[#f8faf9] px-6 py-8 text-center transition hover:border-[#c68b1b] hover:bg-[#fffaf0]">
                <FileText className="mx-auto text-[#c68b1b]" size={31} />
                <span className="mt-3 block font-bold text-[#10283f]">Choose supporting documents</span>
                <span className="mt-1 block text-xs leading-5 text-[#69757e]">PDF, DOCX, PPTX, TXT, or Markdown · up to 8 files</span>
                <input
                  type="file"
                  name="sources"
                  multiple
                  accept=".pdf,.docx,.pptx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/markdown"
                  className="sr-only"
                  onChange={(event) => setFiles(Array.from(event.target.files || []).slice(0, 8))}
                />
              </label>

              {files.length ? (
                <div className="mt-4 divide-y divide-[#10283f]/10 rounded-2xl border border-[#10283f]/10 px-4">
                  {files.map((file) => (
                    <div key={`${file.name}-${file.lastModified}`} className="flex min-w-0 items-center justify-between gap-4 py-3 text-sm">
                      <span className="min-w-0 truncate font-semibold text-[#263746]">{file.name}</span>
                      <span className="shrink-0 text-xs text-[#7a858c]">{fileSize(file.size)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between py-3 text-xs font-bold text-[#69757e]">
                    <span>{files.length} source{files.length === 1 ? "" : "s"}</span>
                    <span>{fileSize(totalBytes)} total</span>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm leading-6 text-[#69757e]">
                  Documents are optional. AI can build from your description alone, but source material improves factual accuracy and company-specific detail.
                </p>
              )}
            </section>
          </div>

          <aside className="min-w-0">
            <div className="sticky top-6 space-y-5 rounded-3xl border border-[#10283f]/10 bg-white p-6 shadow-lg">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#10283f] text-amber-300"><Palette size={20} /></span>
                <div>
                  <p className="text-xs font-black uppercase tracking-[.14em] text-[#9a6812]">Editable draft</p>
                  <p className="font-bold text-[#10283f]">You keep creative control</p>
                </div>
              </div>
              <p className="text-sm leading-6 text-[#69757e]">
                After generation, edit chapter names, objectives, explanations, activities, answer choices, feedback, order, branding, and publishing settings.
              </p>

              {building ? (
                <div className="rounded-2xl bg-[#10283f] p-5 text-white">
                  <LoaderCircle className="animate-spin text-amber-300" size={24} />
                  <p className="mt-4 text-xs font-black uppercase tracking-[.14em] text-amber-200">Building your course</p>
                  <p className="mt-2 font-semibold leading-6">{buildStages[stage]}</p>
                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/15">
                    <div className="h-full rounded-full bg-amber-300 transition-[width] duration-700" style={{ width: `${((stage + 1) / buildStages.length) * 100}%` }} />
                  </div>
                </div>
              ) : null}

              {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold leading-6 text-red-800">{error}</div> : null}

              <button
                type="submit"
                disabled={building}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#c68b1b] px-5 py-4 font-black text-white shadow-sm transition hover:bg-[#ad7614] disabled:cursor-wait disabled:opacity-60"
              >
                {building ? <LoaderCircle className="animate-spin" size={18} /> : <Sparkles size={18} />}
                {building ? "Creating editable draft…" : "Generate my course"}
              </button>
              <div className="flex items-start gap-3 rounded-2xl bg-[#f3f5f5] p-4 text-xs leading-5 text-[#66737c]">
                <BookOpenCheck className="mt-0.5 shrink-0 text-[#477083]" size={17} />
                The generated course begins as a private draft. Nothing is published until you review and approve it.
              </div>
            </div>
          </aside>
        </form>
      </div>
    </AdminShell>
  );
}
