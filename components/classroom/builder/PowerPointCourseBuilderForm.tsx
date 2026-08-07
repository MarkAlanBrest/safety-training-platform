"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  LoaderCircle,
  Plus,
  Trash2,
  UploadCloud,
} from "lucide-react";
import {
  BuilderField,
  BuilderInput,
  BuilderSection,
} from "@/components/classroom/builder/BuilderSection";
import {
  VOICE_OPTIONS,
  VOICE_PROVIDER_OPTIONS,
  defaultClassroomBuilderConfig,
  type VoiceProvider,
} from "@/lib/classroom-builder";
import {
  completeClassroomAssetUpload,
  uploadClassroomAsset,
} from "@/lib/classroom-asset-upload-client";
import { classroomChapterDeckAssetPath } from "@/lib/classroom-chapters";
import { preparePptxForUpload } from "@/lib/ppt-ingest-client";
import type { ParsedClassroomSlide } from "@/lib/ppt-ingest-core";
import { parseJsonResponse } from "@/lib/parse-response";

type SubmitMode = "draft" | "publish";

type ChapterDraft = {
  id: string;
  title: string;
  file: File;
  slides: ParsedClassroomSlide[];
};

type CourseResult = {
  previewUrl: string;
  adminUrl: string;
  slideCount: number;
  published: boolean;
  course: { title: string; slug: string };
};

function titleFromFile(file: File) {
  return file.name.replace(/\.pptx$/i, "").replace(/[-_]+/g, " ").trim();
}

function chapterLineup(chapter: ChapterDraft, chapterIndex: number) {
  return chapter.slides.map((slide, slideIndex) => ({
    kind: "content" as const,
    id: `chapter-${chapterIndex + 1}-slide-${slideIndex + 1}`,
    title: slide.title || `Slide ${slideIndex + 1}`,
    teachingContent: slide.speakerNotes?.trim() || "",
  }));
}

export default function PowerPointCourseBuilderForm() {
  const defaults = useMemo(() => defaultClassroomBuilderConfig(), []);
  const [courseName, setCourseName] = useState("");
  const [chapters, setChapters] = useState<ChapterDraft[]>([]);
  const [voiceProvider, setVoiceProvider] = useState<VoiceProvider>(
    defaults.teaching.voiceProvider,
  );
  const [voice, setVoice] = useState(defaults.teaching.voice);
  const [preparing, setPreparing] = useState(false);
  const [progress, setProgress] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CourseResult | null>(null);

  const estimates = useMemo(() => {
    const slides = chapters.flatMap((chapter) => chapter.slides);
    const totalSlides = slides.length;
    const noteWords = slides.reduce(
      (total, slide) =>
        total + (slide.speakerNotes?.trim().split(/\s+/).filter(Boolean).length || 0),
      0,
    );
    const estimatedMinutes = Math.max(
      totalSlides ? 1 : 0,
      Math.ceil(Math.max(totalSlides * 0.75, noteWords / 130)),
    );
    // Approximate one concise teaching turn per slide. Actual token use depends on
    // questions, learner responses, and whether vision is needed for note-free slides.
    const aiInstructionCost = totalSlides * 0.02;
    const voiceCost = voiceProvider === "premium" ? estimatedMinutes * 0.015 : 0;
    return {
      totalSlides,
      estimatedMinutes,
      aiInstructionCost,
      voiceCost,
      totalCost: aiInstructionCost + voiceCost,
    };
  }, [chapters, voiceProvider]);

  async function addPowerPoints(selected: FileList | null) {
    const files = Array.from(selected || []);
    if (!files.length) return;

    setPreparing(true);
    setError("");
    try {
      const prepared: ChapterDraft[] = [];
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        setProgress(`Reading ${file.name} (${index + 1} of ${files.length})…`);
        const slides = await preparePptxForUpload(file, (message) =>
          setProgress(`${file.name}: ${message}`),
        );
        prepared.push({
          id: crypto.randomUUID(),
          title: titleFromFile(file) || `Chapter ${chapters.length + index + 1}`,
          file,
          slides,
        });
      }
      setChapters((current) => [...current, ...prepared]);
      if (!courseName.trim() && prepared[0]) setCourseName(prepared[0].title);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "A PowerPoint could not be prepared.",
      );
    } finally {
      setPreparing(false);
      setProgress("");
    }
  }

  function updateChapterTitle(id: string, title: string) {
    setChapters((current) =>
      current.map((chapter) => (chapter.id === id ? { ...chapter, title } : chapter)),
    );
  }

  function moveChapter(index: number, direction: -1 | 1) {
    setChapters((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function submit(mode: SubmitMode) {
    const title = courseName.trim();
    if (!title || !chapters.length || chapters.some((chapter) => !chapter.slides.length)) {
      setError("Enter a course name and add at least one PowerPoint before continuing.");
      return;
    }

    setSubmitting(true);
    setError("");
    setProgress("Creating course chapters…");

    try {
      const config = {
        ...defaults,
        knowledge: {
          ...defaults.knowledge,
          courseName: title,
          description: "",
          estimatedMinutes: estimates.estimatedMinutes,
        },
        teaching: {
          ...defaults.teaching,
          voiceProvider,
          voice,
        },
      };
      const response = await fetch("/api/classroom/content-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: "",
          published: false,
          config,
          chapters: chapters.map((chapter, index) => ({
            title: chapter.title.trim() || `Chapter ${index + 1}`,
            fileName: chapter.file.name,
            lineup: chapterLineup(chapter, index),
          })),
          assessment: [],
        }),
      });
      const data = await parseJsonResponse<CourseResult & { error?: string }>(response);
      if (!response.ok) throw new Error(data.error || "Course could not be created.");

      for (let index = 0; index < chapters.length; index += 1) {
        const chapter = chapters[index];
        setProgress(`Uploading chapter ${index + 1} of ${chapters.length}: ${chapter.file.name}…`);
        await uploadClassroomAsset(
          data.course.slug,
          classroomChapterDeckAssetPath(index + 1),
          chapter.file,
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        );
      }

      setProgress("Finishing course…");
      await completeClassroomAssetUpload(data.course.slug, mode === "publish");
      setResult({ ...data, published: mode === "publish" });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Course could not be created.");
    } finally {
      setSubmitting(false);
      setProgress("");
    }
  }

  if (result) {
    return (
      <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-6 py-8 text-center">
        <p className="text-sm font-bold uppercase tracking-[.18em] text-emerald-700">Course ready</p>
        <h2 className="mt-2 font-serif text-3xl font-semibold text-[#10283f]">
          {result.course.title}
        </h2>
        <p className="mt-2 text-sm text-[#69757e]">
          {chapters.length} chapter{chapters.length === 1 ? "" : "s"} · {result.slideCount} slides · {result.published ? "Published" : "Saved as draft"}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href={result.previewUrl}
            className="inline-flex items-center gap-2 rounded-full bg-[#10283f] px-5 py-2.5 text-sm font-semibold text-white"
          >
            <Eye size={15} /> Preview course
          </Link>
          <Link
            href={result.adminUrl}
            className="rounded-full border border-[#10283f]/15 px-5 py-2.5 text-sm font-semibold text-[#10283f]"
          >
            Course settings
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form className="space-y-6" onSubmit={(event) => event.preventDefault()}>
      <BuilderSection number={1} title="Course and chapters">
        <BuilderField label="Course name">
          <BuilderInput
            value={courseName}
            onChange={(event) => setCourseName(event.target.value)}
            placeholder="Forklift Safety"
            required
          />
        </BuilderField>

        <BuilderField
          label="PowerPoint chapters (.pptx)"
          hint="Add one or several decks. They play in the order shown below as chapters in one course."
        >
          <label className="block cursor-pointer rounded-2xl border border-dashed border-[#10283f]/20 bg-[#faf8f3] px-5 py-7 text-center">
            <UploadCloud className="mx-auto text-[#a06e16]" size={28} />
            <span className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#10283f] px-4 py-2 text-sm font-semibold text-white">
              <Plus size={15} /> Add PowerPoint
            </span>
            <input
              type="file"
              multiple
              accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
              disabled={preparing || submitting}
              onChange={(event) => {
                void addPowerPoints(event.target.files);
                event.currentTarget.value = "";
              }}
              className="sr-only"
            />
          </label>
        </BuilderField>

        {chapters.length ? (
          <ol className="space-y-3">
            {chapters.map((chapter, index) => (
              <li
                key={chapter.id}
                className="grid gap-3 rounded-2xl border border-[#10283f]/10 bg-white p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
              >
                <span className="grid h-9 w-9 place-items-center rounded-full bg-[#fff3d6] text-sm font-bold text-[#8a5d0a]">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <BuilderInput
                    value={chapter.title}
                    onChange={(event) => updateChapterTitle(chapter.id, event.target.value)}
                    aria-label={`Chapter ${index + 1} title`}
                  />
                  <p className="mt-1 truncate text-xs text-[#69757e]">
                    {chapter.file.name} · {chapter.slides.length} slide{chapter.slides.length === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => moveChapter(index, -1)}
                    disabled={index === 0}
                    className="rounded-lg border border-[#10283f]/10 p-2 disabled:opacity-30"
                    aria-label={`Move chapter ${index + 1} up`}
                  >
                    <ArrowUp size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveChapter(index, 1)}
                    disabled={index === chapters.length - 1}
                    className="rounded-lg border border-[#10283f]/10 p-2 disabled:opacity-30"
                    aria-label={`Move chapter ${index + 1} down`}
                  >
                    <ArrowDown size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setChapters((current) => current.filter((item) => item.id !== chapter.id))
                    }
                    className="rounded-lg border border-red-200 p-2 text-red-600"
                    aria-label={`Remove chapter ${index + 1}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </li>
            ))}
          </ol>
        ) : null}

        {preparing && progress ? (
          <p className="inline-flex items-center gap-2 text-sm text-[#69757e]">
            <LoaderCircle className="animate-spin" size={15} /> {progress}
          </p>
        ) : null}
      </BuilderSection>

      <BuilderSection number={2} title="Instructor voice">
        <BuilderField
          label="Voice quality"
          hint="The free voice uses the learner's browser. Paid AI voices sound more natural and stay consistent across devices."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {VOICE_PROVIDER_OPTIONS.map((option) => (
              <label
                key={option.id}
                className={`cursor-pointer rounded-2xl border p-4 ${
                  voiceProvider === option.id
                    ? "border-[#c68b1b] bg-[#fff9eb] ring-2 ring-[#e8c273]/25"
                    : "border-[#10283f]/10 bg-white"
                }`}
              >
                <span className="flex items-center gap-2 font-semibold text-[#10283f]">
                  <input
                    type="radio"
                    name="voiceProvider"
                    checked={voiceProvider === option.id}
                    onChange={() => setVoiceProvider(option.id)}
                    className="accent-[#c68b1b]"
                  />
                  {option.label}
                </span>
                <span className="mt-2 block text-xs leading-5 text-[#69757e]">
                  {option.description}
                </span>
              </label>
            ))}
          </div>
        </BuilderField>

        <BuilderField
          label="AI voice"
          hint={voiceProvider === "browser" ? "The learner's browser selects its available voice." : undefined}
        >
          <select
            value={voice}
            disabled={voiceProvider === "browser"}
            onChange={(event) => setVoice(event.target.value)}
            className="w-full rounded-xl border border-[#10283f]/15 bg-white px-4 py-3 disabled:opacity-50"
          >
            {VOICE_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </BuilderField>
      </BuilderSection>

      <BuilderSection number={3} title="Estimate and publish">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Estimate label="Chapters" value={String(chapters.length)} />
          <Estimate label="Slides" value={String(estimates.totalSlides)} />
          <Estimate label="Teaching time" value={`~${estimates.estimatedMinutes} min`} />
          <Estimate label="Cost per learner" value={`~$${estimates.totalCost.toFixed(2)}`} />
        </div>
        <div className="rounded-2xl bg-[#faf8f3] px-4 py-3 text-xs leading-5 text-[#69757e]">
          AI instruction estimate: ${estimates.aiInstructionCost.toFixed(2)}. Voice estimate: {voiceProvider === "premium" ? `$${estimates.voiceCost.toFixed(2)}` : "$0.00 (free browser voice)"}. Actual cost varies with learner questions, note length, and visual analysis.
        </div>

        {(submitting && progress) ? (
          <p className="inline-flex items-center gap-2 text-sm text-[#69757e]">
            <LoaderCircle className="animate-spin" size={15} /> {progress}
          </p>
        ) : null}
        {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

        <div className="flex flex-wrap justify-end gap-3">
          <button
            type="button"
            disabled={submitting || preparing || !courseName.trim() || !chapters.length}
            onClick={() => void submit("draft")}
            className="rounded-full border border-[#10283f]/15 px-5 py-3 text-sm font-semibold text-[#10283f] disabled:opacity-40"
          >
            Save draft
          </button>
          <button
            type="button"
            disabled={submitting || preparing || !courseName.trim() || !chapters.length}
            onClick={() => void submit("publish")}
            className="rounded-full bg-[#10283f] px-6 py-3 text-sm font-semibold text-white disabled:opacity-40"
          >
            {submitting ? "Creating course…" : "Create and publish"}
          </button>
        </div>
      </BuilderSection>
    </form>
  );
}

function Estimate({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#10283f]/10 bg-white px-4 py-4">
      <p className="text-xs font-bold uppercase tracking-[.12em] text-[#69757e]">{label}</p>
      <p className="mt-2 text-lg font-semibold text-[#10283f]">{value}</p>
    </div>
  );
}
