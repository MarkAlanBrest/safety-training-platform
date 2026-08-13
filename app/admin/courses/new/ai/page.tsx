"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpenCheck,
  BrainCircuit,
  Check,
  FileText,
  Images,
  LoaderCircle,
  Palette,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import AdminShell from "@/components/AdminShell";
import { courseThemes } from "@/lib/course-options";
import { parseJsonResponse } from "@/lib/parse-response";
import { prepareAiCourseSources } from "@/lib/ai-course-source-client";

const buildStages = [
  "Reading your brief and source material",
  "Designing the course structure",
  "Writing lessons and realistic examples",
  "Creating activities and assessments",
  "Finding pictures from your PowerPoint",
  "Assembling the editable course",
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
  const requestController = useRef<AbortController | null>(null);
  const jobIdRef = useRef<string | null>(null);
  const stoppedByUser = useRef(false);

  const totalBytes = useMemo(() => files.reduce((total, file) => total + file.size, 0), [files]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBuilding(true);
    setStage(0);
    setError("");
    stoppedByUser.current = false;
    jobIdRef.current = null;

    const timer = window.setInterval(() => {
      setStage((current) => Math.min(buildStages.length - 1, current + 1));
    }, 9000);
    const controller = new AbortController();
    requestController.current = controller;

    try {
      const form = new FormData(event.currentTarget);
      const hasPowerPoint = files.some((file) => file.name.toLowerCase().endsWith(".pptx"));
      const pictureMode = hasPowerPoint ? "source" : String(form.get("pictureMode") || "source");
      form.set("pictureMode", pictureMode);
      const jobSettings = {
        requestedTitle: String(form.get("title") || ""),
        requestedTheme: String(form.get("theme") || "auto"),
        displayMode: String(form.get("displayMode") || "webpage"),
        pictureMode,
        estimatedMinutes: Number(form.get("estimatedMinutes")) || 30,
        appearance: String(form.get("appearance") || "light"),
        toolbarStyle: String(form.get("toolbarStyle") || "guided"),
        aiCoach: String(form.get("aiCoach") || "ask"),
        knowledgeScope: String(form.get("knowledgeScope") || "course"),
      };
      setStage(1);
      const preparedSources = await prepareAiCourseSources(
        files,
        jobSettings.pictureMode === "source",
      );
      form.delete("sources");
      preparedSources.uploadFiles.forEach((file) => form.append("sources", file, file.name));
      const response = await fetch("/api/admin/courses/generate", {
        method: "POST",
        body: form,
        signal: controller.signal,
      });
      let payload = await parseJsonResponse<{ jobId?: string; status?: string; adminUrl?: string; error?: string }>(response);
      if (!response.ok || !payload.jobId) {
        throw new Error(payload.error || "The course draft could not be generated.");
      }
      jobIdRef.current = payload.jobId;

      while (!payload.adminUrl) {
        await new Promise((resolve) => window.setTimeout(resolve, 3500));
        const needsPowerPointPictures = payload.status === "awaiting_sources";
        let pollResponse: Response;
        if (needsPowerPointPictures) {
          const finalizeForm = new FormData();
          finalizeForm.set("jobId", jobIdRef.current || "");
          finalizeForm.set("title", jobSettings.requestedTitle);
          finalizeForm.set("theme", jobSettings.requestedTheme);
          finalizeForm.set("displayMode", jobSettings.displayMode);
          finalizeForm.set("pictureMode", jobSettings.pictureMode);
          finalizeForm.set("estimatedMinutes", String(jobSettings.estimatedMinutes));
          finalizeForm.set("appearance", jobSettings.appearance);
          finalizeForm.set("toolbarStyle", jobSettings.toolbarStyle);
          finalizeForm.set("aiCoach", jobSettings.aiCoach);
          finalizeForm.set("knowledgeScope", jobSettings.knowledgeScope);
          finalizeForm.set(
            "sourcePictureManifest",
            JSON.stringify(
              preparedSources.pictures.map((picture) => ({
                slideNumber: picture.slideNumber,
                title: picture.title,
                context: picture.context,
                sourceName: picture.sourceName,
              })),
            ),
          );
          preparedSources.pictures.forEach((picture) =>
            finalizeForm.append("sourcePictures", picture.file, picture.file.name),
          );
          preparedSources.uploadFiles
            .filter((file) => file.name.toLowerCase().endsWith("-powerpoint-content.txt"))
            .forEach((file) => finalizeForm.append("sources", file, file.name));
          pollResponse = await fetch("/api/admin/courses/generate", {
            method: "POST",
            body: finalizeForm,
            signal: controller.signal,
          });
        } else {
          pollResponse = await fetch("/api/admin/courses/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({ jobId: jobIdRef.current, ...jobSettings }),
          });
        }
        payload = await parseJsonResponse<{ jobId?: string; status?: string; adminUrl?: string; error?: string }>(pollResponse);
        if (!pollResponse.ok && pollResponse.status !== 202) {
          throw new Error(payload.error || "The background course job could not be completed.");
        }
      }
      jobIdRef.current = null;
      router.push(payload.adminUrl);
      router.refresh();
    } catch (reason) {
      const aborted = reason instanceof Error && reason.name === "AbortError";
      setError(
        aborted && stoppedByUser.current
          ? "Course generation was stopped."
          : aborted
            ? "The progress connection was interrupted. The background job may still be running; refresh and try checking again."
          : reason instanceof Error
            ? reason.message
            : "The course draft could not be generated.",
      );
    } finally {
      window.clearInterval(timer);
      requestController.current = null;
      setBuilding(false);
    }
  }

  async function stopGeneration() {
    stoppedByUser.current = true;
    requestController.current?.abort();
    const jobId = jobIdRef.current;
    jobIdRef.current = null;
    if (jobId) {
      await fetch(`/api/admin/courses/generate?jobId=${encodeURIComponent(jobId)}`, { method: "DELETE" }).catch(() => undefined);
    }
  }

  return (
    <AdminShell title="Create a course with AI" eyebrow="AI course studio">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/admin/courses/new"
          className="inline-flex items-center gap-2 text-sm font-bold text-[#69757e] hover:text-[#10283f]"
        >
          <ArrowLeft size={16} /> Back to course types
        </Link>
        <section className="mt-5 overflow-hidden rounded-[2rem] bg-[#10283f] text-white shadow-xl">
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
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#f2ecfb] text-[#644b87]">
                  <Palette size={21} />
                </span>
                <div>
                  <p className="text-xs font-black uppercase tracking-[.15em] text-[#725792]">Learning experience</p>
                  <h3 className="font-serif text-2xl font-semibold text-[#10283f]">Choose how the class should feel</h3>
                </div>
              </div>

              <fieldset className="mt-7">
                <legend className="text-sm font-bold text-[#263746]">Course view</legend>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {[
                    {
                      id: "webpage",
                      name: "Scrolling page",
                      description: "A polished article-style class with activities placed naturally in the lesson.",
                    },
                    {
                      id: "slideshow",
                      name: "Slide presentation",
                      description: "One focused teaching moment at a time with Previous and Next navigation.",
                    },
                  ].map((option) => (
                    <label key={option.id} className="cursor-pointer">
                      <input
                        type="radio"
                        name="displayMode"
                        value={option.id}
                        defaultChecked={option.id === "webpage"}
                        className="peer sr-only"
                      />
                      <span className="block h-full rounded-2xl border border-[#10283f]/10 p-4 transition peer-checked:border-[#c68b1b] peer-checked:bg-[#fff9eb] peer-checked:ring-2 peer-checked:ring-[#e8c273]/25">
                        <span className="font-bold text-[#10283f]">{option.name}</span>
                        <span className="mt-1 block text-sm leading-6 text-[#69757e]">{option.description}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="mt-7">
                <legend className="text-sm font-bold text-[#263746]">Visual theme</legend>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="cursor-pointer">
                    <input type="radio" name="theme" value="auto" defaultChecked className="peer sr-only" />
                    <span className="block h-full rounded-2xl border border-[#10283f]/10 p-4 transition peer-checked:border-[#c68b1b] peer-checked:bg-[#fff9eb] peer-checked:ring-2 peer-checked:ring-[#e8c273]/25">
                      <span className="flex overflow-hidden rounded-full">
                        {courseThemes.map((theme) => (
                          <span key={theme.id} className="h-3 flex-1" style={{ backgroundColor: theme.colors[2] }} />
                        ))}
                      </span>
                      <span className="mt-3 block font-bold text-[#10283f]">Let AI choose</span>
                      <span className="mt-1 block text-xs leading-5 text-[#69757e]">Match the subject and audience.</span>
                    </span>
                  </label>
                  {courseThemes.map((theme) => (
                    <label key={theme.id} className="cursor-pointer">
                      <input type="radio" name="theme" value={theme.id} className="peer sr-only" />
                      <span className="block h-full rounded-2xl border border-[#10283f]/10 p-4 transition peer-checked:border-[#c68b1b] peer-checked:bg-[#fff9eb] peer-checked:ring-2 peer-checked:ring-[#e8c273]/25">
                        <span className="flex overflow-hidden rounded-full">
                          {theme.colors.map((color) => (
                            <span key={color} className="h-3 flex-1" style={{ backgroundColor: color }} />
                          ))}
                        </span>
                        <span className="mt-3 block font-bold text-[#10283f]">{theme.name}</span>
                        <span className="mt-1 block text-xs leading-5 text-[#69757e]">{theme.description}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="mt-7 border-t border-[#10283f]/10 pt-7">
                <legend className="flex items-center gap-2 text-sm font-bold text-[#263746]">
                  <Images size={17} className="text-[#9a6812]" /> Course pictures
                </legend>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {[
                    {
                      id: "source",
                      name: "Use PowerPoint pictures",
                      description: "Use every PowerPoint slide as the course roadmap, retain its pictures, and add interactions between redesigned lessons.",
                    },
                    {
                      id: "ai",
                      name: "New AI pictures only",
                      description: "Create one new photorealistic, editable landscape picture for each chapter.",
                    },
                    {
                      id: "none",
                      name: "No generated pictures",
                      description: "Build the course without image-generation time or cost. Pictures can be added later.",
                    },
                  ].map((option) => (
                    <label key={option.id} className="cursor-pointer">
                      <input
                        type="radio"
                        name="pictureMode"
                        value={option.id}
                        defaultChecked={option.id === "source"}
                        className="peer sr-only"
                      />
                      <span className="block h-full rounded-2xl border border-[#10283f]/10 p-4 transition peer-checked:border-[#c68b1b] peer-checked:bg-[#fff9eb] peer-checked:ring-2 peer-checked:ring-[#e8c273]/25">
                        <span className="font-bold text-[#10283f]">{option.name}</span>
                        <span className="mt-1 block text-sm leading-6 text-[#69757e]">{option.description}</span>
                      </span>
                    </label>
                  ))}
                </div>
                <p className="mt-3 text-xs leading-5 text-[#69757e]">
                  When a PowerPoint is uploaded, roadmap mode automatically preserves its slide order and original pictures. The AI-only option applies to courses without a PowerPoint.
                </p>
              </fieldset>

              <div className="mt-7 grid gap-6 border-t border-[#10283f]/10 pt-7 sm:grid-cols-2">
                <fieldset>
                  <legend className="text-sm font-bold text-[#263746]">Starting appearance</legend>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {[
                      { id: "light", name: "Light" },
                      { id: "dark", name: "Dark" },
                    ].map((option) => (
                      <label key={option.id} className="cursor-pointer">
                        <input type="radio" name="appearance" value={option.id} defaultChecked={option.id === "light"} className="peer sr-only" />
                        <span className="block rounded-xl border border-[#10283f]/10 px-3 py-3 text-center text-sm font-bold peer-checked:border-[#10283f] peer-checked:bg-[#10283f] peer-checked:text-white">
                          {option.name}
                        </span>
                      </label>
                    ))}
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[#69757e]">Learners can switch light and dark from the toolbar.</p>
                </fieldset>

                <fieldset>
                  <legend className="text-sm font-bold text-[#263746]">Toolbar design</legend>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {[
                      { id: "minimal", name: "Minimal" },
                      { id: "guided", name: "Guided" },
                    ].map((option) => (
                      <label key={option.id} className="cursor-pointer">
                        <input type="radio" name="toolbarStyle" value={option.id} defaultChecked={option.id === "guided"} className="peer sr-only" />
                        <span className="block rounded-xl border border-[#10283f]/10 px-3 py-3 text-center text-sm font-bold peer-checked:border-[#10283f] peer-checked:bg-[#10283f] peer-checked:text-white">
                          {option.name}
                        </span>
                      </label>
                    ))}
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[#69757e]">Guided uses labeled tools; Minimal uses compact icons.</p>
                </fieldset>
              </div>

              <fieldset className="mt-7 border-t border-[#10283f]/10 pt-7">
                <legend className="text-sm font-bold text-[#263746]">AI course instructor</legend>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {[
                    { id: "off", name: "Off", description: "No chatbot" },
                    { id: "ask", name: "Ask only", description: "Learner opens it" },
                    { id: "guided", name: "Guided", description: "Offers coaching ideas" },
                  ].map((option) => (
                    <label key={option.id} className="cursor-pointer">
                      <input type="radio" name="aiCoach" value={option.id} defaultChecked={option.id === "ask"} className="peer sr-only" />
                      <span className="block h-full rounded-xl border border-[#10283f]/10 p-3 peer-checked:border-[#10283f] peer-checked:bg-[#eef3f6]">
                        <span className="block text-sm font-bold text-[#10283f]">{option.name}</span>
                        <span className="mt-1 block text-xs text-[#69757e]">{option.description}</span>
                      </span>
                    </label>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-4 text-sm">
                  <span className="font-bold text-[#263746]">Answer boundary:</span>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input type="radio" name="knowledgeScope" value="course" defaultChecked /> Course material only
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input type="radio" name="knowledgeScope" value="expanded" /> Course plus labeled general knowledge
                  </label>
                </div>
              </fieldset>
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
                  Documents are optional. PowerPoints are prepared in your browser so large decks upload reliably while keeping slide text, notes, and useful pictures.
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
                  <p className="mt-2 text-xs leading-5 text-slate-300">The class is building in the background. Larger courses can take several minutes without being discarded.</p>
                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/15">
                    <div className="h-full rounded-full bg-amber-300 transition-[width] duration-700" style={{ width: `${((stage + 1) / buildStages.length) * 100}%` }} />
                  </div>
                  <button
                    type="button"
                    onClick={() => void stopGeneration()}
                    className="mt-4 text-xs font-bold text-amber-200 underline decoration-amber-200/40 underline-offset-4 hover:text-white"
                  >
                    Stop generation
                  </button>
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
