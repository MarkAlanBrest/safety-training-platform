"use client";

import Link from "next/link";
import { useState } from "react";
import { Eye, LoaderCircle, UploadCloud } from "lucide-react";
import { BuilderField, BuilderInput, BuilderSection } from "@/components/classroom/builder/BuilderSection";
import { defaultClassroomBuilderConfig } from "@/lib/classroom-builder";
import {
  completeClassroomAssetUpload,
  uploadClassroomAsset,
} from "@/lib/classroom-asset-upload-client";
import { classroomChapterDeckAssetPath } from "@/lib/classroom-chapters";
import { preparePptxForUpload } from "@/lib/ppt-ingest-client";
import type { ParsedClassroomSlide } from "@/lib/ppt-ingest-core";
import { parseJsonResponse } from "@/lib/parse-response";

type SubmitMode = "draft" | "publish";

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

export default function PowerPointCourseBuilderForm() {
  const [courseName, setCourseName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [slides, setSlides] = useState<ParsedClassroomSlide[]>([]);
  const [preparing, setPreparing] = useState(false);
  const [progress, setProgress] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CourseResult | null>(null);

  async function handlePowerPoint(selected: File | null) {
    setFile(selected);
    setSlides([]);
    setError("");
    if (!selected) return;

    setPreparing(true);
    setProgress("Reading slide order and speaker notes…");
    try {
      const parsed = await preparePptxForUpload(selected, (message) => setProgress(message));
      setSlides(parsed);
      setCourseName((current) => current.trim() || titleFromFile(selected));
    } catch (uploadError) {
      setFile(null);
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "The PowerPoint could not be prepared.",
      );
    } finally {
      setPreparing(false);
    }
  }

  async function submit(mode: SubmitMode) {
    const title = courseName.trim();
    if (!title || !file || !slides.length) {
      setError("Enter a course name and choose a PowerPoint before continuing.");
      return;
    }

    setSubmitting(true);
    setError("");
    setProgress("Creating course…");

    try {
      const defaults = defaultClassroomBuilderConfig();
      const config = {
        ...defaults,
        knowledge: {
          ...defaults.knowledge,
          courseName: title,
          description: "",
        },
      };
      const lineup = slides.map((slide, index) => ({
        kind: "content" as const,
        id: `ppt-slide-${index + 1}`,
        title: slide.title || `Slide ${index + 1}`,
        teachingContent: slide.speakerNotes?.trim() || "",
      }));

      const response = await fetch("/api/classroom/content-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: "",
          published: false,
          config,
          lineup,
          assessment: [],
        }),
      });
      const data = await parseJsonResponse<CourseResult & { error?: string }>(response);
      if (!response.ok) throw new Error(data.error || "Course could not be created.");

      setProgress("Uploading the original PowerPoint…");
      await uploadClassroomAsset(
        data.course.slug,
        classroomChapterDeckAssetPath(1),
        file,
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      );

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
          {result.slideCount} slides · {result.published ? "Published" : "Saved as draft"}
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
      <BuilderSection number={1} title="Course">
        <BuilderField label="Course name">
          <BuilderInput
            value={courseName}
            onChange={(event) => setCourseName(event.target.value)}
            placeholder="Forklift Safety"
            required
          />
        </BuilderField>

        <BuilderField
          label="PowerPoint (.pptx)"
          hint="The deck supplies every course screen. Speaker notes are the AI instructor's slide-by-slide prompt."
        >
          <label className="block cursor-pointer rounded-2xl border border-dashed border-[#10283f]/20 bg-[#faf8f3] px-5 py-8 text-center">
            <UploadCloud className="mx-auto text-[#a06e16]" size={28} />
            <input
              type="file"
              accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
              disabled={preparing || submitting}
              onChange={(event) => void handlePowerPoint(event.target.files?.[0] || null)}
              className="mt-4 block w-full text-sm text-[#69757e]"
            />
            {file && slides.length ? (
              <p className="mt-3 text-sm font-semibold text-emerald-700">
                Ready — {file.name} · {slides.length} slide{slides.length === 1 ? "" : "s"}
              </p>
            ) : null}
          </label>
        </BuilderField>

        {(preparing || submitting) && progress ? (
          <p className="inline-flex items-center gap-2 text-sm text-[#69757e]">
            <LoaderCircle className="animate-spin" size={15} /> {progress}
          </p>
        ) : null}
        {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      </BuilderSection>

      <div className="flex flex-wrap justify-end gap-3">
        <button
          type="button"
          disabled={submitting || preparing || !courseName.trim() || !slides.length}
          onClick={() => void submit("draft")}
          className="rounded-full border border-[#10283f]/15 px-5 py-3 text-sm font-semibold text-[#10283f] disabled:opacity-40"
        >
          Save draft
        </button>
        <button
          type="button"
          disabled={submitting || preparing || !courseName.trim() || !slides.length}
          onClick={() => void submit("publish")}
          className="rounded-full bg-[#10283f] px-6 py-3 text-sm font-semibold text-white disabled:opacity-40"
        >
          {submitting ? "Creating course…" : "Create and publish"}
        </button>
      </div>
    </form>
  );
}
