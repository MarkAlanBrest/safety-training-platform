"use client";

import Link from "next/link";
import { FormEvent, type MouseEvent as ReactMouseEvent, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ClipboardCheck,
  Crosshair,
  ImagePlus,
  LoaderCircle,
  MessageSquare,
  Plus,
  Sparkles,
  Trash2,
  UploadCloud,
  Video,
} from "lucide-react";
import {
  AI_PERSONALITIES,
  ClassroomBuilderConfig,
  TEACHING_STYLES,
  VOICE_OPTIONS,
  VOICE_PROVIDER_OPTIONS,
  defaultClassroomBuilderConfig,
} from "@/lib/classroom-builder";
import {
  BuilderField,
  BuilderInput,
  BuilderRadioGroup,
  BuilderSection,
  BuilderTextarea,
} from "@/components/classroom/builder/BuilderSection";
import { parseJsonResponse } from "@/lib/parse-response";
import {
  parsePptxTeachingNotes,
  prepareContentSlidesFromPptxNotesOnly,
  prepareContentSlidesFromZipAndPptx,
} from "@/lib/ppt-ingest-client";
import {
  completeClassroomAssetUpload,
  uploadClassroomAsset,
} from "@/lib/classroom-asset-upload-client";
import { classroomChapterDeckAssetPath, classroomChapterSlideAssetPath } from "@/lib/classroom-chapters";
import {
  emptyActivity,
  emptyContentSlide,
  emptyFormative,
  emptyVideo,
  createLineupId,
  formativeFromQuestion,
  SLIDE_TRANSITIONS,
  type LessonLineupItem,
  type LineupActivity,
  type LineupContentSlide,
  type LineupFormative,
  type LineupVideo,
  type SlideTransition,
} from "@/lib/classroom-lineup";
import {
  QUESTION_TYPES,
  QUESTION_TYPE_LABELS,
  defaultFinalTestConfig,
  type ClassroomFinalTestConfig,
  type ClassroomQuestion,
  type GeneratedFormative,
  type MultipleChoiceQuestion,
  type QuestionType,
  DEFAULT_HOTSPOT_TOLERANCE,
} from "@/lib/classroom-question-types";
import QuestionDraftReview from "@/components/classroom/builder/QuestionDraftReview";
import FinalTestConfigSection from "@/components/classroom/builder/FinalTestConfigSection";

type SubmitMode = "draft" | "publish";

type ContentSlideDraft = LineupContentSlide & {
  imageFile?: File;
  previewUrl?: string;
};

type VideoDraft = LineupVideo & {
  videoFile?: File;
  previewUrl?: string;
};

type FormativeDraft = LineupFormative & {
  hotspotImageFile?: File;
  hotspotPreviewUrl?: string;
  hotspotTargetSet?: boolean;
};

type LineupDraftItem =
  | ContentSlideDraft
  | FormativeDraft
  | LineupActivity
  | VideoDraft;

function isContentSlide(item: LineupDraftItem): item is ContentSlideDraft {
  return item.kind === "content";
}

function isVideo(item: LineupDraftItem): item is VideoDraft {
  return item.kind === "video";
}

export default function ContentSlideBuilderForm() {
  const [config, setConfig] = useState<ClassroomBuilderConfig>(defaultClassroomBuilderConfig());
  const [lineup, setLineup] = useState<LineupDraftItem[]>([emptyContentSlide("Slide 1")]);
  const [assessment, setAssessment] = useState<MultipleChoiceQuestion[]>([]);
  const [questionBank, setQuestionBank] = useState<ClassroomQuestion[]>([]);
  const [finalTestConfig, setFinalTestConfig] = useState<ClassroomFinalTestConfig>(
    defaultFinalTestConfig(),
  );
  const [generateFile, setGenerateFile] = useState<File | null>(null);
  const [generateIncludeTypes, setGenerateIncludeTypes] = useState<QuestionType[]>([...QUESTION_TYPES]);
  const [generateCount, setGenerateCount] = useState(20);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const [generationKey, setGenerationKey] = useState(0);
  const [pendingGeneration, setPendingGeneration] = useState<{
    formatives: GeneratedFormative[];
    bankQuestions: ClassroomQuestion[];
    warnings: string[];
  } | null>(null);
  const [sourcePptx, setSourcePptx] = useState<File | null>(null);
  const [slideImagesFromZip, setSlideImagesFromZip] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState("");
  const [uploadProgress, setUploadProgress] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    previewUrl: string;
    adminUrl: string;
    slideCount: number;
    course: { title: string; slug: string };
    published: boolean;
  } | null>(null);

  const contentSlideCount = lineup.filter(isContentSlide).length;

  const canSubmit = useMemo(() => {
    if (!config.knowledge.courseName.trim()) return false;
    if (!contentSlideCount) return false;
    return lineup.every((item) => {
      if (isContentSlide(item)) return Boolean(item.imageFile) || Boolean(sourcePptx);
      if (isVideo(item)) return Boolean(item.videoFile);
      if (item.kind === "formative" && item.type === "hotspot") {
        return Boolean(item.hotspotImageFile && item.hotspot && item.hotspotTargetSet);
      }
      return true;
    });
  }, [config.knowledge.courseName, contentSlideCount, lineup, sourcePptx]);

  function updateLineup(updater: (current: LineupDraftItem[]) => LineupDraftItem[]) {
    setLineup((current) => updater(current));
  }

  function moveItem(index: number, direction: -1 | 1) {
    updateLineup((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function removeItem(index: number) {
    updateLineup((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function updateContentSlide(index: number, patch: Partial<ContentSlideDraft>) {
    updateLineup((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index && isContentSlide(item) ? { ...item, ...patch } : item,
      ),
    );
  }

  function updateFormative(index: number, patch: Partial<FormativeDraft>) {
    updateLineup((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index && item.kind === "formative" ? { ...item, ...patch } : item,
      ),
    );
  }

  function updateActivity(index: number, patch: Partial<LineupActivity>) {
    updateLineup((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index && item.kind === "activity" ? { ...item, ...patch } : item,
      ),
    );
  }

  function updateVideo(index: number, patch: Partial<VideoDraft>) {
    updateLineup((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index && isVideo(item) ? { ...item, ...patch } : item,
      ),
    );
  }

  function handleVideoSelect(index: number, file: File | null) {
    if (!file) return;
    if (!/^video\/(?:mp4|webm)$/.test(file.type)) {
      setError("Video slides support MP4 and WebM files.");
      return;
    }
    if (file.size > 200 * 1024 * 1024) {
      setError("Video files are limited to 200 MB.");
      return;
    }
    setError("");
    updateVideo(index, { videoFile: file, previewUrl: URL.createObjectURL(file) });
  }

  function handleHotspotImageSelect(index: number, file: File | null) {
    if (!file) return;
    if (!/^image\/(?:png|jpeg|webp)$/.test(file.type)) {
      setError("Click-the-picture activities support PNG, JPEG, and WebP images.");
      return;
    }
    setError("");
    updateFormative(index, {
      hotspotImageFile: file,
      hotspotPreviewUrl: URL.createObjectURL(file),
      hotspotTargetSet: false,
    });
  }

  function setHotspotTarget(index: number, event: ReactMouseEvent<HTMLElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const targetX = ((event.clientX - bounds.left) / bounds.width) * 100;
    const targetY = ((event.clientY - bounds.top) / bounds.height) * 100;
    const item = lineup[index];
    if (item?.kind !== "formative") return;
    updateFormative(index, {
      hotspotTargetSet: true,
      hotspot: {
        imageUrl: item.hotspot?.imageUrl || `asset:classroom/activities/${item.id}`,
        targetX,
        targetY,
        toleranceRadius: item.hotspot?.toleranceRadius || DEFAULT_HOTSPOT_TOLERANCE,
      },
    });
  }

  function emptyDragDrop(): FormativeDraft {
    return {
      ...emptyFormative(),
      type: "dragdrop",
      headline: "Put the steps in order",
      prompt: "Drag these items into the correct order.",
      choices: undefined,
      dragItems: ["First step", "Second step", "Third step"],
    };
  }

  function emptyHotspot(): FormativeDraft {
    const item = emptyFormative();
    return {
      ...item,
      type: "hotspot",
      headline: "Click the correct area",
      prompt: "Select the correct item in the picture.",
      choices: undefined,
      hotspot: {
        imageUrl: `asset:classroom/activities/${item.id}`,
        targetX: 50,
        targetY: 50,
        toleranceRadius: DEFAULT_HOTSPOT_TOLERANCE,
      },
    };
  }

  function applyImportedContentSlides(
    contentSlides: ContentSlideDraft[],
    pptxFile?: File | null,
    fromZip = false,
  ) {
    updateLineup((current) => {
      const preserved = current.filter((item) => item.kind !== "content");
      return [...contentSlides, ...preserved];
    });
    if (pptxFile) setSourcePptx(pptxFile);
    setSlideImagesFromZip(fromZip);
  }

  async function handleZipAndPptxImport(zipFile: File | null, pptxFile: File | null) {
    if (!zipFile) {
      setError("Choose a ZIP of slide images first.");
      return;
    }

    setImporting(true);
    setImportProgress("Importing slide images…");
    setError("");

    try {
      const imported = await prepareContentSlidesFromZipAndPptx(
        zipFile,
        pptxFile,
        setImportProgress,
      );
      const contentSlides: ContentSlideDraft[] = imported.map((slide) => ({
        kind: "content",
        id: createLineupId("content"),
        title: slide.title,
        teachingContent: slide.teachingContent,
        imageFile: slide.imageFile,
        previewUrl: slide.previewUrl,
      }));

      applyImportedContentSlides(contentSlides, pptxFile, true);

      const nameSource = pptxFile?.name || zipFile.name;
      if (!config.knowledge.courseName.trim()) {
        const courseName = nameSource
          .replace(/\.(pptx|zip)$/i, "")
          .replace(/[-_]+/g, " ")
          .trim();
        setConfig((current) => ({
          ...current,
          knowledge: { ...current.knowledge, courseName },
        }));
      }
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Could not import this package.");
    } finally {
      setImporting(false);
      setImportProgress("");
    }
  }

  async function handleAttachPptxNotes(file: File | null) {
    if (!file) return;

    setImporting(true);
    setImportProgress("Reading speaker notes…");
    setError("");

    try {
      const notes = await parsePptxTeachingNotes(file);
      const contentSlides = lineup.filter(isContentSlide);

      if (!contentSlides.length) {
        throw new Error("Import slide images first, then attach the PowerPoint for speaker notes.");
      }

      if (notes.length !== contentSlides.length) {
        throw new Error(
          `The PowerPoint has ${notes.length} slides but you have ${contentSlides.length} content slides. The counts must match.`,
        );
      }

      updateLineup((current) => {
        let contentIndex = 0;
        return current.map((item) => {
          if (!isContentSlide(item)) return item;
          const note = notes[contentIndex];
          contentIndex += 1;
          return {
            ...item,
            title: note?.title || item.title,
            teachingContent: note?.teachingContent || item.teachingContent,
          };
        });
      });

      setSourcePptx(file);

      if (!config.knowledge.courseName.trim()) {
        const courseName = file.name.replace(/\.pptx$/i, "").replace(/[-_]+/g, " ").trim();
        setConfig((current) => ({
          ...current,
          knowledge: { ...current.knowledge, courseName },
        }));
      }
    } catch (importError) {
      setError(
        importError instanceof Error ? importError.message : "Could not read speaker notes.",
      );
    } finally {
      setImporting(false);
      setImportProgress("");
    }
  }

  async function handlePptxImport(file: File | null) {
    if (!file) return;
    setImporting(true);
    setImportProgress("Reading PowerPoint…");
    setError("");
    try {
      const imported = await prepareContentSlidesFromPptxNotesOnly(file, setImportProgress);
      const contentSlides: ContentSlideDraft[] = imported.map((slide) => ({
        kind: "content",
        id: createLineupId("content"),
        title: slide.title,
        teachingContent: slide.teachingContent,
      }));

      applyImportedContentSlides(contentSlides, file, false);

      if (!config.knowledge.courseName.trim()) {
        const courseName = file.name.replace(/\.pptx$/i, "").replace(/[-_]+/g, " ").trim();
        setConfig((current) => ({
          ...current,
          knowledge: { ...current.knowledge, courseName },
        }));
      }
    } catch (importError) {
      setError(
        importError instanceof Error ? importError.message : "Could not import this PowerPoint.",
      );
    } finally {
      setImporting(false);
      setImportProgress("");
    }
  }

  function handleImageSelect(index: number, file: File | null) {
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    updateContentSlide(index, { imageFile: file, previewUrl });
  }

  function addAssessmentQuestion() {
    setAssessment((current) => [
      ...current,
      {
        id: createLineupId("assessment"),
        type: "multipleChoice",
        prompt: "",
        choices: ["", "", "", ""],
        correctChoice: "",
      },
    ]);
  }

  function updateAssessmentQuestion(
    index: number,
    patch: Partial<MultipleChoiceQuestion>,
  ) {
    setAssessment((current) =>
      current.map((question, questionIndex) =>
        questionIndex === index ? { ...question, ...patch } : question,
      ),
    );
  }

  function removeAssessmentQuestion(index: number) {
    setAssessment((current) => current.filter((_, questionIndex) => questionIndex !== index));
  }

  function cleanedAssessment(): MultipleChoiceQuestion[] {
    return assessment
      .map((question) => ({
        ...question,
        prompt: question.prompt.trim(),
        choices: question.choices.map((choice) => choice.trim()).filter(Boolean),
        correctChoice: question.correctChoice.trim(),
      }))
      .filter((question) => question.prompt && question.choices.length >= 2)
      .map((question) => ({
        ...question,
        correctChoice:
          question.correctChoice && question.choices.includes(question.correctChoice)
            ? question.correctChoice
            : question.choices[0],
      }));
  }

  function finalTestPayload() {
    if (!finalTestConfig.enabled || !questionBank.length) return null;
    return { config: finalTestConfig, questionBank };
  }

  function toggleGenerateType(type: QuestionType, checked: boolean) {
    setGenerateIncludeTypes((current) =>
      checked ? [...current, type] : current.filter((item) => item !== type),
    );
  }

  async function handleGenerateQuestions() {
    if (!generateFile) {
      setGenerateError("Choose a .pptx or .pdf file first.");
      return;
    }
    setGenerating(true);
    setGenerateError("");
    try {
      const form = new FormData();
      form.set("file", generateFile);
      form.set("courseTitle", config.knowledge.courseName.trim());
      form.set("courseDescription", config.knowledge.description.trim());
      form.set("includeTypes", JSON.stringify(generateIncludeTypes));
      form.set("finalTestQuestionCount", String(generateCount));

      const response = await fetch("/api/classroom/generate-questions", {
        method: "POST",
        body: form,
      });
      const data = await parseJsonResponse<{
        error?: string;
        lineupFormatives: GeneratedFormative[];
        finalTestQuestionBank: ClassroomQuestion[];
        warnings: string[];
      }>(response);

      if (!response.ok) throw new Error(data.error || "Questions could not be generated.");

      setPendingGeneration({
        formatives: data.lineupFormatives,
        bankQuestions: data.finalTestQuestionBank,
        warnings: data.warnings,
      });
      setGenerationKey((key) => key + 1);
    } catch (genError) {
      setGenerateError(
        genError instanceof Error ? genError.message : "Questions could not be generated.",
      );
    } finally {
      setGenerating(false);
    }
  }

  function acceptGeneratedFormative(item: GeneratedFormative) {
    const formative = formativeFromQuestion(item.question, item.headline);
    updateLineup((current) => {
      let seenContent = -1;
      let insertAt = current.length;
      let foundTarget = false;

      for (let index = 0; index < current.length; index += 1) {
        const entry = current[index];
        if (isContentSlide(entry)) {
          if (foundTarget) break;
          seenContent += 1;
          if (seenContent === item.slideIndex) {
            foundTarget = true;
            insertAt = index + 1;
          }
          continue;
        }
        if (foundTarget) insertAt = index + 1;
      }

      const next = [...current];
      next.splice(insertAt, 0, formative);
      return next;
    });
  }

  function acceptGeneratedBankQuestion(question: ClassroomQuestion) {
    setQuestionBank((current) => [...current, question]);
    if (!finalTestConfig.enabled) {
      setFinalTestConfig((current) => ({ ...current, enabled: true }));
    }
  }

  async function uploadManualAddonAssets(slug: string) {
    for (const item of lineup) {
      if (isVideo(item) && item.videoFile) {
        setUploadProgress(`Uploading video: ${item.title || item.videoFile.name}â€¦`);
        await uploadClassroomAsset(
          slug,
          `classroom/media/${item.id}`,
          item.videoFile,
          item.videoFile.type,
        );
      }

      if (
        item.kind === "formative" &&
        item.type === "hotspot" &&
        item.hotspotImageFile
      ) {
        setUploadProgress(`Uploading activity image: ${item.headline}â€¦`);
        await uploadClassroomAsset(
          slug,
          `classroom/activities/${item.id}`,
          item.hotspotImageFile,
          item.hotspotImageFile.type,
        );
      }
    }
  }

  async function onSubmit(event: FormEvent, mode: SubmitMode) {
    event.preventDefault();
    if (!canSubmit) {
      setError("Add every required slide image, video, and click-the-picture image before continuing.");
      return;
    }

    setSubmitting(true);
    setUploadProgress("Creating course…");
    setError("");

    try {
      const payloadLineup: LessonLineupItem[] = lineup.map((item) => {
        if (isContentSlide(item)) {
          return {
            kind: "content",
            id: item.id,
            title: item.title,
            transition: item.transition,
            teachingContent:
              item.teachingContent.trim() ||
              `Teach what's shown on "${item.title || "this slide"}".`,
          };
        }
        if (isVideo(item)) {
          return {
            kind: "video",
            id: item.id,
            title: item.title.trim() || "Video demonstration",
            prompt: item.prompt.trim(),
            videoUrl: `asset:classroom/media/${item.id}`,
          };
        }
        if (item.kind === "formative") {
          return {
            kind: "formative",
            id: item.id,
            headline: item.headline,
            prompt: item.prompt,
            type: item.type,
            choices: item.choices?.map((choice) => choice.trim()).filter(Boolean),
            correctChoice: item.correctChoice,
            correctAnswerBool: item.correctAnswerBool,
            flashcards: item.flashcards,
            dragItems: item.dragItems?.map((entry) => entry.trim()).filter(Boolean),
            hotspot: item.hotspot
              ? {
                  ...item.hotspot,
                  imageUrl: `asset:classroom/activities/${item.id}`,
                }
              : undefined,
            sampleAnswer: item.sampleAnswer,
            keyPoints: item.keyPoints,
          };
        }
        return {
          kind: "activity",
          id: item.id,
          headline: item.headline,
          prompt: item.prompt,
          activityType: item.activityType,
          choices: item.choices?.map((choice) => choice.trim()).filter(Boolean),
        };
      });

      if (sourcePptx && !slideImagesFromZip) {
        setUploadProgress("Rendering slides and creating course…");
        const form = new FormData();
        form.set("pptx", sourcePptx);
        form.set("title", config.knowledge.courseName.trim());
        form.set("description", config.knowledge.description.trim());
        form.set("published", mode === "publish" ? "true" : "false");
        form.set("config", JSON.stringify(config));
        form.set("lineup", JSON.stringify(payloadLineup));
        form.set("assessment", JSON.stringify(cleanedAssessment()));
        form.set("finalTest", JSON.stringify(finalTestPayload()));

        const response = await fetch("/api/classroom/import-pptx", {
          method: "POST",
          body: form,
        });

        const data = await parseJsonResponse<{
          error?: string;
          previewUrl: string;
          adminUrl: string;
          slideCount: number;
          published: boolean;
          course: { title: string; slug: string };
        }>(response);

        if (!response.ok) throw new Error(data.error || "Course could not be created.");
        await uploadManualAddonAssets(data.course.slug);
        setResult(data);
        return;
      }

      const response = await fetch("/api/classroom/content-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: config.knowledge.courseName.trim(),
          description: config.knowledge.description.trim(),
          published: mode === "publish",
          config,
          lineup: payloadLineup,
          assessment: cleanedAssessment(),
          finalTest: finalTestPayload(),
        }),
      });

      const data = await parseJsonResponse<{
        error?: string;
        previewUrl: string;
        adminUrl: string;
        slideCount: number;
        published: boolean;
        course: { title: string; slug: string };
      }>(response);

      if (!response.ok) throw new Error(data.error || "Course could not be created.");

      let slideIndex = 0;
      for (const item of lineup) {
        if (!isContentSlide(item) || !item.imageFile) continue;
        setUploadProgress(`Uploading slide ${slideIndex + 1}…`);
        await uploadClassroomAsset(
          data.course.slug,
          classroomChapterSlideAssetPath(1, slideIndex),
          item.imageFile,
          item.imageFile.type || "image/jpeg",
        );
        slideIndex += 1;
      }

      await uploadManualAddonAssets(data.course.slug);

      if (sourcePptx) {
        setUploadProgress("Saving PowerPoint source file…");
        await uploadClassroomAsset(
          data.course.slug,
          classroomChapterDeckAssetPath(1),
          sourcePptx,
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        );
      }

      setUploadProgress("Finishing course…");
      await completeClassroomAssetUpload(data.course.slug, mode === "publish");
      data.published = mode === "publish";
      setResult(data);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Course could not be created.");
    } finally {
      setSubmitting(false);
      setUploadProgress("");
    }
  }

  if (result) {
    return (
      <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-6 py-8 text-center">
        <p className="text-sm font-bold uppercase tracking-[.18em] text-emerald-700">Course ready</p>
        <h2 className="mt-2 font-serif text-3xl font-semibold text-[#10283f]">{result.course.title}</h2>
        <p className="mt-2 text-sm text-[#69757e]">
          {result.slideCount} content slides · {result.published ? "Published" : "Saved as draft"}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href={result.previewUrl}
            className="rounded-full bg-[#10283f] px-5 py-2.5 text-sm font-semibold text-white"
          >
            Preview classroom
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
      <BuilderSection number={1} title="Course details">
        <BuilderField label="Course name">
          <BuilderInput
            value={config.knowledge.courseName}
            onChange={(event) =>
              setConfig((current) => ({
                ...current,
                knowledge: { ...current.knowledge, courseName: event.target.value },
              }))
            }
            placeholder="Forklift safety refresher"
            required
          />
        </BuilderField>
        <BuilderField
          label="Description"
          hint="Shown at the start of class. The AI instructor uses your content-slide notes for each slide."
        >
          <BuilderTextarea
            rows={3}
            value={config.knowledge.description}
            onChange={(event) =>
              setConfig((current) => ({
                ...current,
                knowledge: { ...current.knowledge, description: event.target.value },
              }))
            }
            placeholder="What learners should expect from this lesson."
          />
        </BuilderField>
      </BuilderSection>

      <BuilderSection number={2} title="Lesson lineup">
        <div className="rounded-2xl border border-[#10283f]/10 bg-[#faf8f3] px-4 py-4 text-sm leading-6 text-[#69757e]">
          <p>
            <strong>Easiest:</strong> upload your <strong>.pptx</strong> and we&apos;ll convert slides
            to pictures on the server and pull speaker notes for the AI instructor.
          </p>
          <p className="mt-2">
            <strong>Or do it yourself:</strong> export slide pictures as a ZIP and attach the
            PowerPoint for notes — best when you want pixel-perfect control over each image.
          </p>
        </div>

        <BuilderField
          label="Upload PowerPoint (.pptx)"
          hint="Upload your deck once. Slides play with transitions, animations, and embedded video. Speaker notes become the AI teaching script."
        >
          <div className="rounded-2xl border border-dashed border-[#10283f]/20 bg-white px-5 py-5 text-center">
            <UploadCloud className="mx-auto text-[#a06e16]" size={24} />
            <input
              type="file"
              accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
              disabled={importing}
              onChange={(event) => void handlePptxImport(event.target.files?.[0] || null)}
              className="mt-3 block w-full text-sm text-[#69757e]"
            />
            {sourcePptx && !slideImagesFromZip ? (
              <p className="mt-2 text-sm font-medium text-emerald-700">Loaded — {sourcePptx.name}</p>
            ) : (
              <p className="mt-2 text-xs text-[#69757e]">
                Speaker notes become the AI teaching script for each slide.
              </p>
            )}
          </div>
        </BuilderField>

        {importing && importProgress ? (
          <p className="inline-flex items-center gap-2 text-sm text-[#69757e]">
            <LoaderCircle className="animate-spin" size={14} />
            {importProgress}
          </p>
        ) : null}

        <details className="rounded-2xl border border-[#10283f]/10 bg-white px-4 py-4">
          <summary className="cursor-pointer text-sm font-semibold text-[#10283f]">
            Manual: ZIP slide pictures + attach PowerPoint
          </summary>
          <div className="mt-4 space-y-4">
            <BuilderField
              label="Slide images (.zip)"
              hint="Export slides from PowerPoint as PNG or JPEG, then ZIP them in slide order."
            >
              <div className="rounded-2xl border border-dashed border-[#10283f]/20 bg-[#faf8f3] px-5 py-5 text-center">
                <input
                  type="file"
                  accept=".zip,application/zip"
                  disabled={importing}
                  onChange={(event) => {
                    const zipFile = event.target.files?.[0] || null;
                    if (zipFile) void handleZipAndPptxImport(zipFile, sourcePptx);
                  }}
                  className="block w-full text-sm text-[#69757e]"
                />
              </div>
            </BuilderField>

            <BuilderField
              label="PowerPoint for speaker notes (.pptx)"
              hint="Attach the original deck. Slide count must match your ZIP."
            >
              <div className="rounded-2xl border border-dashed border-[#10283f]/20 bg-[#faf8f3] px-5 py-5 text-center">
                <input
                  type="file"
                  accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                  disabled={importing}
                  onChange={(event) => {
                    const pptxFile = event.target.files?.[0] || null;
                    if (!pptxFile) return;
                    const hasContentSlides = lineup.some(isContentSlide);
                    if (hasContentSlides) {
                      void handleAttachPptxNotes(pptxFile);
                    } else {
                      setSourcePptx(pptxFile);
                    }
                  }}
                  className="block w-full text-sm text-[#69757e]"
                />
                {sourcePptx && slideImagesFromZip ? (
                  <p className="mt-2 text-sm font-medium text-emerald-700">
                    Attached — {sourcePptx.name}
                  </p>
                ) : null}
              </div>
            </BuilderField>
          </div>
        </details>

        <div className="space-y-4">
          {lineup.map((item, index) => (
            <div
              key={item.id}
              className="rounded-2xl border border-[#10283f]/10 bg-white p-4 shadow-sm"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.14em] text-[#a06e16]">
                  {item.kind === "content" ? (
                    <>
                      <ImagePlus size={14} />
                      Content slide
                    </>
                  ) : item.kind === "video" ? (
                    <>
                      <Video size={14} />
                      Video slide
                    </>
                  ) : item.kind === "formative" ? (
                    <>
                      <ClipboardCheck size={14} />
                      Formative check
                    </>
                  ) : (
                    <>
                      <MessageSquare size={14} />
                      Activity
                    </>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveItem(index, -1)}
                    disabled={index === 0}
                    className="rounded-lg border border-[#10283f]/10 p-2 text-[#69757e] disabled:opacity-30"
                    aria-label="Move up"
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveItem(index, 1)}
                    disabled={index === lineup.length - 1}
                    className="rounded-lg border border-[#10283f]/10 p-2 text-[#69757e] disabled:opacity-30"
                    aria-label="Move down"
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="rounded-lg border border-red-200 p-2 text-red-600"
                    aria-label="Remove"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {isContentSlide(item) ? (
                <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
                  <div className="space-y-3">
                    <label className="block cursor-pointer rounded-xl border border-dashed border-[#10283f]/20 bg-[#faf8f3] p-3 text-center">
                      {item.previewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.previewUrl}
                          alt={item.title}
                          className="mx-auto max-h-36 w-full rounded-lg object-contain"
                        />
                      ) : (
                        <div className="py-8 text-sm text-[#69757e]">
                          <ImagePlus className="mx-auto mb-2 text-[#a06e16]" size={22} />
                          Upload slide image
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="sr-only"
                        onChange={(event) =>
                          handleImageSelect(index, event.target.files?.[0] || null)
                        }
                      />
                    </label>
                    <BuilderInput
                      value={item.title}
                      onChange={(event) => updateContentSlide(index, { title: event.target.value })}
                      placeholder="Slide title (optional)"
                    />
                    <label className="block">
                      <span className="mb-1 block text-xs font-bold text-[#263746]">Transition</span>
                      <select
                        value={item.transition || "fade"}
                        onChange={(event) =>
                          updateContentSlide(index, {
                            transition: event.target.value as SlideTransition,
                          })
                        }
                        className="w-full rounded-xl border border-[#10283f]/15 px-3 py-2 text-sm"
                      >
                        {SLIDE_TRANSITIONS.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <BuilderField
                    label="What should the AI teach on this slide?"
                    hint="This is your instructor script. The AI reads the slide image and teaches from your notes — not from on-screen text."
                  >
                    <BuilderTextarea
                      rows={8}
                      value={item.teachingContent}
                      onChange={(event) =>
                        updateContentSlide(index, { teachingContent: event.target.value })
                      }
                      placeholder="Explain the hazard shown here, walk through the inspection steps, and give a job-site example."
                      required
                    />
                  </BuilderField>
                </div>
              ) : null}

              {isVideo(item) ? (
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(260px,.8fr)]">
                  <BuilderField label="Video file" hint="MP4 or WebM, up to 200 MB">
                    <label className="block cursor-pointer rounded-xl border border-dashed border-[#10283f]/20 bg-[#faf8f3] p-4 text-center">
                      {item.previewUrl ? (
                        <video
                          src={item.previewUrl}
                          controls
                          className="mx-auto max-h-64 w-full rounded-lg bg-black"
                        />
                      ) : (
                        <div className="py-8 text-sm text-[#69757e]">
                          <Video className="mx-auto mb-2 text-[#a06e16]" size={26} />
                          Select an MP4 or WebM video
                        </div>
                      )}
                      <input
                        type="file"
                        accept="video/mp4,video/webm"
                        className="sr-only"
                        onChange={(event) =>
                          handleVideoSelect(index, event.target.files?.[0] || null)
                        }
                      />
                    </label>
                  </BuilderField>
                  <div className="space-y-4">
                    <BuilderField label="Video title">
                      <BuilderInput
                        value={item.title}
                        onChange={(event) => updateVideo(index, { title: event.target.value })}
                      />
                    </BuilderField>
                    <BuilderField label="Instructions shown above the video">
                      <BuilderTextarea
                        rows={4}
                        value={item.prompt}
                        onChange={(event) => updateVideo(index, { prompt: event.target.value })}
                      />
                    </BuilderField>
                  </div>
                </div>
              ) : null}

              {item.kind === "formative" ? (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <BuilderField label="Headline">
                      <BuilderInput
                        value={item.headline}
                        onChange={(event) => updateFormative(index, { headline: event.target.value })}
                      />
                    </BuilderField>
                    <BuilderField label="Question type">
                      <select
                        value={item.type}
                        onChange={(event) => {
                          const type = event.target.value as LineupFormative["type"];
                          updateFormative(index, {
                            type,
                            dragItems:
                              type === "dragdrop"
                                ? item.dragItems || ["First step", "Second step", "Third step"]
                                : item.dragItems,
                            hotspot:
                              type === "hotspot"
                                ? item.hotspot || {
                                    imageUrl: `asset:classroom/activities/${item.id}`,
                                    targetX: 50,
                                    targetY: 50,
                                    toleranceRadius: DEFAULT_HOTSPOT_TOLERANCE,
                                  }
                                : item.hotspot,
                          });
                        }}
                        className="w-full rounded-xl border border-[#10283f]/15 px-4 py-3"
                      >
                        <option value="multipleChoice">Multiple choice</option>
                        <option value="exercise">Open exercise</option>
                        <option value="flashcard">Flash cards</option>
                        <option value="dragdrop">Drag & drop order</option>
                        <option value="hotspot">Click the picture</option>
                      </select>
                    </BuilderField>
                  </div>
                  <BuilderField label="Prompt">
                    <BuilderTextarea
                      rows={3}
                      value={item.prompt}
                      onChange={(event) => updateFormative(index, { prompt: event.target.value })}
                    />
                  </BuilderField>
                  {item.type === "multipleChoice" || item.type === "exercise" ? (
                    <div className="space-y-2">
                      {(item.choices || ["", "", "", ""]).map((choice, choiceIndex) => (
                        <BuilderInput
                          key={choiceIndex}
                          value={choice}
                          onChange={(event) => {
                            const choices = [...(item.choices || ["", "", "", ""])];
                            choices[choiceIndex] = event.target.value;
                            updateFormative(index, { choices });
                          }}
                          placeholder={`Choice ${choiceIndex + 1}`}
                        />
                      ))}
                    </div>
                  ) : null}
                  {item.type === "dragdrop" ? (
                    <BuilderField
                      label="Correct order"
                      hint="Enter the steps in the correct order. Learners will receive them shuffled."
                    >
                      <div className="space-y-2">
                        {(item.dragItems || []).map((entry, entryIndex) => (
                          <div key={entryIndex} className="flex items-center gap-2">
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-50 text-xs font-bold text-emerald-700">
                              {entryIndex + 1}
                            </span>
                            <BuilderInput
                              value={entry}
                              onChange={(event) => {
                                const dragItems = [...(item.dragItems || [])];
                                dragItems[entryIndex] = event.target.value;
                                updateFormative(index, { dragItems });
                              }}
                              placeholder={`Step ${entryIndex + 1}`}
                            />
                            <button
                              type="button"
                              onClick={() =>
                                updateFormative(index, {
                                  dragItems: (item.dragItems || []).filter(
                                    (_, itemIndex) => itemIndex !== entryIndex,
                                  ),
                                })
                              }
                              disabled={(item.dragItems?.length || 0) <= 2}
                              className="rounded-lg border border-red-200 p-2 text-red-600 disabled:opacity-30"
                              aria-label={`Remove step ${entryIndex + 1}`}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() =>
                            updateFormative(index, {
                              dragItems: [...(item.dragItems || []), ""],
                            })
                          }
                          className="inline-flex items-center gap-2 rounded-full border border-[#10283f]/15 px-3 py-1.5 text-xs font-semibold text-[#10283f]"
                        >
                          <Plus size={13} /> Add step
                        </button>
                      </div>
                    </BuilderField>
                  ) : null}
                  {item.type === "hotspot" ? (
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                      <BuilderField
                        label="Activity image"
                        hint="Upload the picture, then click the correct target directly on it."
                      >
                        {item.hotspotPreviewUrl ? (
                          <>
                            <button
                              type="button"
                              onClick={(event) => setHotspotTarget(index, event)}
                              className="relative block w-full cursor-crosshair overflow-hidden rounded-xl border-2 border-amber-300 text-left"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={item.hotspotPreviewUrl}
                                alt={item.prompt}
                                className="block w-full select-none"
                                draggable={false}
                              />
                              {item.hotspot && item.hotspotTargetSet ? (
                                <span
                                  className="pointer-events-none absolute h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-red-500 bg-red-100/50 shadow-lg"
                                  style={{
                                    left: `${item.hotspot.targetX}%`,
                                    top: `${item.hotspot.targetY}%`,
                                  }}
                                />
                              ) : null}
                            </button>
                            <p className="mt-2 text-xs font-semibold text-amber-700">
                              {item.hotspotTargetSet
                                ? "Target saved. Click again to move it."
                                : "Click the correct target in the image to save its location."}
                            </p>
                          </>
                        ) : (
                          <label className="block cursor-pointer rounded-xl border border-dashed border-[#10283f]/20 bg-[#faf8f3] p-8 text-center text-sm text-[#69757e]">
                            <Crosshair className="mx-auto mb-2 text-[#a06e16]" size={24} />
                            Upload the activity picture
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp"
                              className="sr-only"
                              onChange={(event) =>
                                handleHotspotImageSelect(
                                  index,
                                  event.target.files?.[0] || null,
                                )
                              }
                            />
                          </label>
                        )}
                        {item.hotspotPreviewUrl ? (
                          <label className="mt-2 inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-[#69757e]">
                            Replace image
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp"
                              className="sr-only"
                              onChange={(event) =>
                                handleHotspotImageSelect(
                                  index,
                                  event.target.files?.[0] || null,
                                )
                              }
                            />
                          </label>
                        ) : null}
                      </BuilderField>
                      <BuilderField
                        label="Click tolerance"
                        hint="How close the learner must click, as a percentage of the image."
                      >
                        <BuilderInput
                          type="number"
                          min={2}
                          max={25}
                          value={item.hotspot?.toleranceRadius || DEFAULT_HOTSPOT_TOLERANCE}
                          onChange={(event) =>
                            updateFormative(index, {
                              hotspot: {
                                imageUrl:
                                  item.hotspot?.imageUrl ||
                                  `asset:classroom/activities/${item.id}`,
                                targetX: item.hotspot?.targetX ?? 50,
                                targetY: item.hotspot?.targetY ?? 50,
                                toleranceRadius: Math.min(
                                  25,
                                  Math.max(2, Number(event.target.value) || 8),
                                ),
                              },
                            })
                          }
                        />
                      </BuilderField>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {item.kind === "activity" ? (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <BuilderField label="Headline">
                      <BuilderInput
                        value={item.headline}
                        onChange={(event) => updateActivity(index, { headline: event.target.value })}
                      />
                    </BuilderField>
                    <BuilderField label="Activity type">
                      <select
                        value={item.activityType}
                        onChange={(event) =>
                          updateActivity(index, {
                            activityType: event.target.value as LineupActivity["activityType"],
                          })
                        }
                        className="w-full rounded-xl border border-[#10283f]/15 px-4 py-3"
                      >
                        <option value="discussion">Discussion</option>
                        <option value="scenario">Scenario</option>
                        <option value="reflection">Reflection</option>
                        <option value="exercise">Exercise</option>
                      </select>
                    </BuilderField>
                  </div>
                  <BuilderField label="Instructions for the AI and learner">
                    <BuilderTextarea
                      rows={4}
                      value={item.prompt}
                      onChange={(event) => updateActivity(index, { prompt: event.target.value })}
                    />
                  </BuilderField>
                </div>
              ) : null}
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              updateLineup((current) => [
                ...current,
                emptyContentSlide(`Slide ${current.filter(isContentSlide).length + 1}`),
              ])
            }
            className="inline-flex items-center gap-2 rounded-full border border-[#10283f]/15 px-4 py-2 text-sm font-semibold text-[#10283f]"
          >
            <Plus size={14} />
            Add content slide
          </button>
          <button
            type="button"
            onClick={() => updateLineup((current) => [...current, emptyVideo()])}
            className="inline-flex items-center gap-2 rounded-full border border-[#10283f]/15 px-4 py-2 text-sm font-semibold text-[#10283f]"
          >
            <Video size={14} />
            Insert video
          </button>
          <button
            type="button"
            onClick={() => updateLineup((current) => [...current, emptyFormative()])}
            className="inline-flex items-center gap-2 rounded-full border border-[#10283f]/15 px-4 py-2 text-sm font-semibold text-[#10283f]"
          >
            <ClipboardCheck size={14} />
            Insert formative check
          </button>
          <button
            type="button"
            onClick={() => updateLineup((current) => [...current, emptyDragDrop()])}
            className="inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800"
          >
            <ClipboardCheck size={14} />
            Insert drag &amp; drop
          </button>
          <button
            type="button"
            onClick={() => updateLineup((current) => [...current, emptyHotspot()])}
            className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800"
          >
            <Crosshair size={14} />
            Insert click-the-picture
          </button>
          <button
            type="button"
            onClick={() => updateLineup((current) => [...current, emptyActivity()])}
            className="inline-flex items-center gap-2 rounded-full border border-[#10283f]/15 px-4 py-2 text-sm font-semibold text-[#10283f]"
          >
            <MessageSquare size={14} />
            Insert activity
          </button>
        </div>
      </BuilderSection>

      <BuilderSection number={3} title="Generate questions with AI">
        <div className="rounded-2xl border border-[#10283f]/10 bg-[#faf8f3] px-4 py-4 text-sm leading-6 text-[#69757e]">
          <p>
            Upload a PowerPoint or PDF and AI will draft multiple choice, true/false, drag &amp;
            drop, click-the-spot, flash card, short answer, and scenario questions from it. Review,
            edit, or delete each draft below — nothing is added until you accept it.
          </p>
        </div>

        <BuilderField label="Source file (.pptx or .pdf)">
          <div className="rounded-2xl border border-dashed border-[#10283f]/20 bg-white px-5 py-5 text-center">
            <input
              type="file"
              accept=".pptx,.pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/pdf"
              disabled={generating}
              onChange={(event) => setGenerateFile(event.target.files?.[0] || null)}
              className="block w-full text-sm text-[#69757e]"
            />
            {generateFile ? (
              <p className="mt-2 text-sm font-medium text-emerald-700">Selected — {generateFile.name}</p>
            ) : null}
          </div>
        </BuilderField>

        <div className="grid gap-4 sm:grid-cols-2">
          <BuilderField label="Question types to generate">
            <div className="flex flex-wrap gap-2">
              {QUESTION_TYPES.map((type) => (
                <label
                  key={type}
                  className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                    generateIncludeTypes.includes(type)
                      ? "border-[#c68b1b] bg-[#fff9eb] text-[#10283f]"
                      : "border-[#10283f]/15 text-[#69757e]"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={generateIncludeTypes.includes(type)}
                    onChange={(event) => toggleGenerateType(type, event.target.checked)}
                    className="accent-[#c68b1b]"
                  />
                  {QUESTION_TYPE_LABELS[type]}
                </label>
              ))}
            </div>
          </BuilderField>
          <BuilderField label="Final test bank size" hint="Target number of questions to draft for the bank">
            <BuilderInput
              type="number"
              min={1}
              max={60}
              value={generateCount}
              onChange={(event) => setGenerateCount(Math.max(1, Number(event.target.value) || 1))}
            />
          </BuilderField>
        </div>

        <button
          type="button"
          disabled={generating || !generateFile}
          onClick={() => void handleGenerateQuestions()}
          className="inline-flex items-center gap-2 rounded-full bg-[#10283f] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {generating ? (
            <>
              <LoaderCircle className="animate-spin" size={14} />
              Generating…
            </>
          ) : (
            <>
              <Sparkles size={14} />
              Generate questions
            </>
          )}
        </button>

        {generateError ? (
          <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {generateError}
          </p>
        ) : null}

        {pendingGeneration ? (
          <QuestionDraftReview
            key={generationKey}
            formatives={pendingGeneration.formatives}
            bankQuestions={pendingGeneration.bankQuestions}
            warnings={pendingGeneration.warnings}
            onAcceptFormative={acceptGeneratedFormative}
            onAcceptBankQuestion={acceptGeneratedBankQuestion}
          />
        ) : null}
      </BuilderSection>

      <BuilderSection number={4} title="Final Test">
        <div className="rounded-2xl border border-[#10283f]/10 bg-[#faf8f3] px-4 py-4 text-sm leading-6 text-[#69757e]">
          <p>
            A configurable test at the end of class, drawn from the question bank you accept above.
            Configure attempts, timing, passing score, and certificate below.
          </p>
        </div>
        <FinalTestConfigSection
          config={finalTestConfig}
          questionCount={questionBank.length}
          onChange={setFinalTestConfig}
        />
        {questionBank.length ? (
          <div className="space-y-2">
            <p className="text-sm font-bold text-[#10283f]">Accepted bank questions ({questionBank.length})</p>
            {questionBank.map((question, index) => (
              <div
                key={question.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-[#10283f]/10 bg-white px-4 py-2 text-sm"
              >
                <span>
                  <span className="mr-2 rounded-full bg-[#faf8f3] px-2 py-0.5 text-xs font-semibold text-[#a06e16]">
                    {QUESTION_TYPE_LABELS[question.type]}
                  </span>
                  {question.type === "scenario" ? question.scenarioText : question.prompt}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setQuestionBank((current) => current.filter((_, itemIndex) => itemIndex !== index))
                  }
                  className="rounded-lg border border-red-200 p-1.5 text-red-600"
                  aria-label="Remove question"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </BuilderSection>

      <BuilderSection number={5} title="Final assessment">
        <div className="rounded-2xl border border-[#10283f]/10 bg-[#faf8f3] px-4 py-4 text-sm leading-6 text-[#69757e]">
          <p>
            Optional test at the end of class. The AI presents each question and the student
            answers in chat. Leave empty to skip the final assessment.
          </p>
        </div>

        {assessment.map((question, index) => (
          <div
            key={question.id}
            className="rounded-2xl border border-[#10283f]/10 bg-white p-4 shadow-sm"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-xs font-bold uppercase tracking-[.14em] text-[#a06e16]">
                Question {index + 1}
              </p>
              <button
                type="button"
                onClick={() => removeAssessmentQuestion(index)}
                className="rounded-lg border border-red-200 p-2 text-red-600"
                aria-label="Remove question"
              >
                <Trash2 size={14} />
              </button>
            </div>
            <BuilderField label="Question">
              <BuilderTextarea
                rows={2}
                value={question.prompt}
                onChange={(event) =>
                  updateAssessmentQuestion(index, { prompt: event.target.value })
                }
                placeholder="What is the first step before operating this equipment?"
              />
            </BuilderField>
            <div className="mt-3 space-y-2">
              {question.choices.map((choice, choiceIndex) => (
                <div key={choiceIndex} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`assessment-correct-${question.id}`}
                    checked={Boolean(choice.trim()) && question.correctChoice === choice}
                    onChange={() =>
                      updateAssessmentQuestion(index, { correctChoice: choice })
                    }
                    disabled={!choice.trim()}
                    title="Mark as correct answer"
                  />
                  <BuilderInput
                    value={choice}
                    onChange={(event) => {
                      const choices = [...question.choices];
                      const previous = choices[choiceIndex];
                      choices[choiceIndex] = event.target.value;
                      updateAssessmentQuestion(index, {
                        choices,
                        correctChoice:
                          question.correctChoice === previous
                            ? event.target.value
                            : question.correctChoice,
                      });
                    }}
                    placeholder={`Choice ${choiceIndex + 1}`}
                  />
                </div>
              ))}
              <p className="text-xs text-[#69757e]">
                Select the radio button next to the correct answer.
              </p>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={addAssessmentQuestion}
          className="inline-flex items-center gap-2 rounded-full border border-[#10283f]/15 px-4 py-2 text-sm font-semibold text-[#10283f]"
        >
          <Plus size={14} />
          Add assessment question
        </button>
      </BuilderSection>

      <BuilderSection number={6} title="AI instructor">
        <div className="grid gap-4 md:grid-cols-2">
          <BuilderField label="Teaching style">
            <BuilderRadioGroup
              name="teaching-style"
              value={config.teaching.style}
              onChange={(value) =>
                setConfig((current) => ({
                  ...current,
                  teaching: { ...current.teaching, style: value },
                }))
              }
              options={TEACHING_STYLES}
            />
          </BuilderField>
          <BuilderField label="Personality">
            <BuilderRadioGroup
              name="personality"
              value={config.teaching.personality}
              onChange={(value) =>
                setConfig((current) => ({
                  ...current,
                  teaching: { ...current.teaching, personality: value },
                }))
              }
              options={AI_PERSONALITIES}
            />
          </BuilderField>
        </div>
        <BuilderField
          label="Voice quality"
          hint="Premium sounds better and stays consistent for every student, but costs money to run. Browser voice is free but varies by student device."
        >
          <div className="grid gap-2 sm:grid-cols-2">
            {VOICE_PROVIDER_OPTIONS.map((option) => (
              <label
                key={option.id}
                className={`flex cursor-pointer flex-col gap-1 rounded-xl border px-4 py-3 text-sm ${
                  config.teaching.voiceProvider === option.id
                    ? "border-[#c68b1b] bg-[#fff9eb] ring-2 ring-[#e8c273]/25"
                    : "border-[#10283f]/10 hover:bg-[#faf8f3]"
                }`}
              >
                <span className="flex items-center gap-2 font-semibold text-[#10283f]">
                  <input
                    type="radio"
                    name="voiceProvider"
                    checked={config.teaching.voiceProvider === option.id}
                    onChange={() =>
                      setConfig((current) => ({
                        ...current,
                        teaching: { ...current.teaching, voiceProvider: option.id },
                      }))
                    }
                    className="accent-[#c68b1b]"
                  />
                  {option.label}
                </span>
                <span className="text-xs leading-5 text-[#69757e]">{option.description}</span>
              </label>
            ))}
          </div>
        </BuilderField>
        <BuilderField
          label="Voice"
          hint={
            config.teaching.voiceProvider === "browser"
              ? "Not used — the student's browser picks its own voice."
              : undefined
          }
        >
          <select
            value={config.teaching.voice}
            disabled={config.teaching.voiceProvider === "browser"}
            onChange={(event) =>
              setConfig((current) => ({
                ...current,
                teaching: { ...current.teaching, voice: event.target.value },
              }))
            }
            className="w-full rounded-xl border border-[#10283f]/15 px-4 py-3 disabled:opacity-50"
          >
            {VOICE_OPTIONS.map((voice) => (
              <option key={voice.id} value={voice.id}>
                {voice.label}
              </option>
            ))}
          </select>
        </BuilderField>
      </BuilderSection>

      {error ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={submitting || !canSubmit}
          onClick={(event) => void onSubmit(event, "draft")}
          className="rounded-full border border-[#10283f]/15 px-5 py-3 text-sm font-semibold text-[#10283f] disabled:opacity-50"
        >
          {submitting ? (
            <span className="inline-flex items-center gap-2">
              <LoaderCircle className="animate-spin" size={14} />
              {uploadProgress || "Saving…"}
            </span>
          ) : (
            "Save draft"
          )}
        </button>
        <button
          type="button"
          disabled={submitting || !canSubmit}
          onClick={(event) => void onSubmit(event, "publish")}
          className="rounded-full bg-[#10283f] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          Publish course
        </button>
        <p className="text-sm text-[#69757e]">
          {contentSlideCount} content slide{contentSlideCount === 1 ? "" : "s"} in lineup
        </p>
      </div>
    </form>
  );
}
