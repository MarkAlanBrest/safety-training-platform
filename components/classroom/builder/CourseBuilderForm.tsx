"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import {
  Eye,
  LoaderCircle,
  Plus,
  Trash2,
  UploadCloud,
} from "lucide-react";
import {
  ACCENT_OPTIONS,
  ACTIVITY_OPTIONS,
  AI_PERSONALITIES,
  CLASSROOM_BUILDER_LIMITS,
  CLASSROOM_BUILDER_PRESETS,
  ClassroomBuilderConfig,
  ClassroomBuilderPreset,
  EXCEL_OPTIONS,
  FORMATIVE_ALLOW_OPTIONS,
  INTERACTION_LEVELS,
  PRESENTATION_OPTIONS,
  STRUGGLE_OPTIONS,
  STUDENT_EXPERIENCE_OPTIONS,
  SUMMATIVE_TYPE_OPTIONS,
  TEACHING_STYLES,
  VOICE_OPTIONS,
  applyClassroomBuilderPreset,
  canToggleFlag,
  defaultClassroomBuilderConfig,
  estimateClassroomCourse,
} from "@/lib/classroom-builder";
import {
  BuilderCheckboxGrid,
  BuilderField,
  BuilderInput,
  BuilderRadioGroup,
  BuilderSection,
  BuilderSubheading,
  BuilderTextarea,
} from "@/components/classroom/builder/BuilderSection";
import { parseJsonResponse } from "@/lib/parse-response";
import {
  buildClassroomUploadFormData,
  buildMultiChapterUploadFormData,
  preparePptxForUpload,
} from "@/lib/ppt-ingest-client";
import type { ParsedClassroomSlide } from "@/lib/ppt-ingest-core";
import { validateSlideImageZip } from "@/lib/ppt-slide-images";
import {
  completeClassroomAssetUpload,
  uploadClassroomAsset,
} from "@/lib/classroom-asset-upload-client";
import {
  classroomChapterDeckAssetPath,
  classroomChapterSlideAssetPath,
} from "@/lib/classroom-chapters";

type SubmitMode = "draft" | "publish";

type ChapterDraft = {
  file: File;
  slideImagesZip: File | null;
  title: string;
  parsedSlides: ParsedClassroomSlide[];
};

export default function CourseBuilderForm() {
  const [config, setConfig] = useState<ClassroomBuilderConfig>(
    defaultClassroomBuilderConfig(),
  );
  const [preset, setPreset] = useState<ClassroomBuilderPreset>("balanced");
  const [file, setFile] = useState<File | null>(null);
  const [slideImagesZip, setSlideImagesZip] = useState<File | null>(null);
  const [parsedSlides, setParsedSlides] = useState<ParsedClassroomSlide[] | null>(null);
  const [extraChapters, setExtraChapters] = useState<ChapterDraft[]>([]);
  const [parsingFile, setParsingFile] = useState(false);
  const [parseProgress, setParseProgress] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    previewUrl: string;
    adminUrl: string;
    slideCount: number;
    course: { title: string; slug: string };
    published: boolean;
  } | null>(null);

  const slideCountEstimate = parsedSlides?.length
    ? parsedSlides.length + extraChapters.reduce((sum, chapter) => sum + chapter.parsedSlides.length, 0)
    : file
      ? Math.max(4, Math.round(file.size / 120_000))
      : 8;
  const estimates = useMemo(
    () => estimateClassroomCourse(slideCountEstimate, config),
    [slideCountEstimate, config],
  );

  function updateKnowledge<K extends keyof ClassroomBuilderConfig["knowledge"]>(
    key: K,
    value: ClassroomBuilderConfig["knowledge"][K],
  ) {
    setConfig((current) => ({
      ...current,
      knowledge: { ...current.knowledge, [key]: value },
    }));
  }

  function updateTeaching<K extends keyof ClassroomBuilderConfig["teaching"]>(
    key: K,
    value: ClassroomBuilderConfig["teaching"][K],
  ) {
    setConfig((current) => ({
      ...current,
      teaching: { ...current.teaching, [key]: value },
    }));
  }

  function updateObjective(index: number, value: string) {
    setConfig((current) => {
      const objectives = [...current.knowledge.objectives];
      objectives[index] = value;
      return { ...current, knowledge: { ...current.knowledge, objectives } };
    });
  }

  function addObjective() {
    setConfig((current) => ({
      ...current,
      knowledge: {
        ...current.knowledge,
        objectives: [...current.knowledge.objectives, ""],
      },
    }));
  }

  function removeObjective(index: number) {
    setConfig((current) => ({
      ...current,
      knowledge: {
        ...current.knowledge,
        objectives: current.knowledge.objectives.filter((_, i) => i !== index),
      },
    }));
  }

  function applyPreset(nextPreset: ClassroomBuilderPreset) {
    setPreset(nextPreset);
    setConfig((current) => applyClassroomBuilderPreset(current, nextPreset));
  }

  function toggleFlag(
    section:
      | "activities"
      | "presentation"
      | "studentExperience"
      | "formativeAllow"
      | "summativeTypes"
      | "struggles"
      | "excels",
    id: string,
    checked: boolean,
  ) {
    setConfig((current) => {
      const limits: Record<typeof section, number> = {
        activities: CLASSROOM_BUILDER_LIMITS.activities,
        presentation: CLASSROOM_BUILDER_LIMITS.presentation,
        studentExperience: CLASSROOM_BUILDER_LIMITS.studentExperience,
        formativeAllow: CLASSROOM_BUILDER_LIMITS.formativeAllow,
        summativeTypes: CLASSROOM_BUILDER_LIMITS.summativeTypes,
        struggles: CLASSROOM_BUILDER_LIMITS.struggles,
        excels: CLASSROOM_BUILDER_LIMITS.excels,
      };

      if (section === "formativeAllow") {
        if (!canToggleFlag(current.formative.allow, id, checked, limits.formativeAllow)) {
          return current;
        }
        return {
          ...current,
          formative: {
            ...current.formative,
            allow: { ...current.formative.allow, [id]: checked },
          },
        };
      }
      if (section === "summativeTypes") {
        if (!canToggleFlag(current.summative.types, id, checked, limits.summativeTypes)) {
          return current;
        }
        return {
          ...current,
          summative: {
            ...current.summative,
            types: { ...current.summative.types, [id]: checked },
          },
        };
      }
      if (section === "struggles") {
        if (!canToggleFlag(current.adaptation.ifStruggles, id, checked, limits.struggles)) {
          return current;
        }
        return {
          ...current,
          adaptation: {
            ...current.adaptation,
            ifStruggles: { ...current.adaptation.ifStruggles, [id]: checked },
          },
        };
      }
      if (section === "excels") {
        if (!canToggleFlag(current.adaptation.ifExcels, id, checked, limits.excels)) {
          return current;
        }
        return {
          ...current,
          adaptation: {
            ...current.adaptation,
            ifExcels: { ...current.adaptation.ifExcels, [id]: checked },
          },
        };
      }
      if (!canToggleFlag(current[section], id, checked, limits[section])) {
        return current;
      }
      return { ...current, [section]: { ...current[section], [id]: checked } };
    });
  }

  async function handleFileSelect(selected: File | null) {
    setFile(selected);
    setSlideImagesZip(null);
    setParsedSlides(null);
    setError("");
    if (!selected) return;

    setParsingFile(true);
    setParseProgress("Reading slides…");
    try {
      const slides = await preparePptxForUpload(selected, (message) => {
        setParseProgress(message);
      });
      setParsedSlides(slides);
    } catch (parseError) {
      setError(
        parseError instanceof Error
          ? parseError.message
          : "This PowerPoint file could not be read.",
      );
    } finally {
      setParsingFile(false);
    }
  }

  async function handleSlideImagesSelect(selected: File | null) {
    setSlideImagesZip(null);
    setError("");
    if (!selected || !parsedSlides?.length) return;
    setParsingFile(true);
    setParseProgress("Checking slide images…");
    try {
      await validateSlideImageZip(selected, parsedSlides.length);
      setSlideImagesZip(selected);
      setParseProgress("Slide images matched");
    } catch (zipError) {
      setError(zipError instanceof Error ? zipError.message : "The slide-image ZIP is invalid.");
    } finally {
      setParsingFile(false);
    }
  }

  async function handleExtraChapterSelect(selected: File | null) {
    if (!selected) return;
    setParsingFile(true);
    setParseProgress("Reading slides…");
    setError("");
    try {
      const slides = await preparePptxForUpload(selected, (message) => {
        setParseProgress(message);
      });
      setExtraChapters((current) => [
        ...current,
        {
          file: selected,
          slideImagesZip: null,
          title: selected.name.replace(/\.pptx$/i, ""),
          parsedSlides: slides,
        },
      ]);
    } catch (parseError) {
      setError(
        parseError instanceof Error ? parseError.message : "That PowerPoint could not be prepared.",
      );
    } finally {
      setParsingFile(false);
    }
  }

  async function handleExtraChapterImages(index: number, selected: File | null) {
    if (!selected) return;
    const chapter = extraChapters[index];
    if (!chapter) return;
    setParsingFile(true);
    setParseProgress(`Checking images for chapter ${index + 2}…`);
    setError("");
    try {
      await validateSlideImageZip(selected, chapter.parsedSlides.length);
      setExtraChapters((current) =>
        current.map((item, itemIndex) =>
          itemIndex === index ? { ...item, slideImagesZip: selected } : item,
        ),
      );
    } catch (zipError) {
      setError(zipError instanceof Error ? zipError.message : "The slide-image ZIP is invalid.");
    } finally {
      setParsingFile(false);
    }
  }

  async function onSubmit(event: FormEvent, mode: SubmitMode) {
    event.preventDefault();
    if (!file || !slideImagesZip || !parsedSlides?.length || !config.knowledge.courseName.trim()) {
      setError("Choose the PowerPoint and its exported slide-image ZIP before continuing.");
      return;
    }
    if (extraChapters.some((chapter) => !chapter.slideImagesZip)) {
      setError("Add the exported slide-image ZIP for every chapter before continuing.");
      return;
    }
    setSubmitting(true);
    setUploadProgress("Creating course…");
    setError("");
    try {
      const chapters = [
        { file, slideImagesZip, title: config.knowledge.courseName.trim(), parsedSlides },
        ...extraChapters.map((chapter) => ({
          ...chapter,
          slideImagesZip: chapter.slideImagesZip as File,
        })),
      ];
      const form =
        chapters.length > 1
          ? buildMultiChapterUploadFormData(chapters, {
              title: config.knowledge.courseName.trim(),
              description: config.knowledge.description.trim(),
              published: mode === "publish",
              config,
            })
          : buildClassroomUploadFormData(file, slideImagesZip, parsedSlides, {
              title: config.knowledge.courseName.trim(),
              description: config.knowledge.description.trim(),
              published: mode === "publish",
              config,
            });
      const response = await fetch("/api/classroom/upload", {
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
      const totalAssets = chapters.reduce(
        (sum, chapter) => sum + chapter.parsedSlides.length + 1,
        0,
      );
      let uploadedAssets = 0;
      for (let chapterIndex = 0; chapterIndex < chapters.length; chapterIndex += 1) {
        const chapter = chapters[chapterIndex];
        const chapterPosition = chapterIndex + 1;
        const exactImages = await validateSlideImageZip(
          chapter.slideImagesZip,
          chapter.parsedSlides.length,
        );
        for (let slideIndex = 0; slideIndex < exactImages.length; slideIndex += 1) {
          setUploadProgress(`Uploading slide ${slideIndex + 1} of ${exactImages.length}…`);
          const image = exactImages[slideIndex];
          await uploadClassroomAsset(
            data.course.slug,
            classroomChapterSlideAssetPath(chapterPosition, slideIndex),
            new Blob([new Uint8Array(image.bytes)], { type: image.mimeType }),
            image.mimeType,
          );
          uploadedAssets += 1;
          setUploadProgress(`Uploaded ${uploadedAssets} of ${totalAssets} course files…`);
        }
        setUploadProgress(`Saving original PowerPoint for chapter ${chapterPosition}…`);
        await uploadClassroomAsset(
          data.course.slug,
          classroomChapterDeckAssetPath(chapterPosition),
          chapter.file,
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        );
        uploadedAssets += 1;
      }
      setUploadProgress("Finishing course…");
      await completeClassroomAssetUpload(data.course.slug, mode === "publish");
      data.published = mode === "publish";
      setResult(data);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Course could not be created.",
      );
    } finally {
      setSubmitting(false);
      setUploadProgress("");
    }
  }

  return (
    <form className="space-y-6">
      <BuilderSection number={1} title="Knowledge Package">
        <BuilderField
          label="Upload PowerPoint (.pptx)"
          hint="Up to 25 MB per deck. Your original PowerPoint is stored and displayed live. The AI instructor teaches from your speaker notes."
        >
          <div className="rounded-2xl border border-dashed border-[#10283f]/20 bg-[#faf8f3] px-5 py-8 text-center">
            <UploadCloud className="mx-auto text-[#a06e16]" size={28} />
            <input
              type="file"
              accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
              onChange={(event) => void handleFileSelect(event.target.files?.[0] || null)}
              className="mt-4 block w-full text-sm text-[#69757e]"
              required
            />
            {file ? (
              <div className="mt-2 space-y-1 text-sm">
                <p className="font-medium text-[#10283f]">{file.name}</p>
                {parsingFile ? (
                  <p className="inline-flex items-center justify-center gap-2 text-[#69757e]">
                    <LoaderCircle className="animate-spin" size={14} />
                    {parseProgress || "Preparing slides from your PowerPoint…"}
                  </p>
                ) : parsedSlides ? (
                  <div className="space-y-1">
                    <p className="text-emerald-700">
                      Ready — {parsedSlides.length} slide
                      {parsedSlides.length === 1 ? "" : "s"} prepared for upload.
                    </p>
                    <p className="text-xs text-[#69757e]">
                      Your original PowerPoint will be stored for future changes. The AI teacher
                      uses its speaker notes while the exported images provide the exact visuals.
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </BuilderField>

        {parsedSlides ? (
          <BuilderField
            label="Upload exported slide images (.zip)"
            hint="In PowerPoint, save all slides as PNG or JPEG, then ZIP the exported folder. The number of images must match the PowerPoint."
          >
            <div className="rounded-2xl border border-dashed border-[#10283f]/20 bg-[#faf8f3] px-5 py-6 text-center">
              <UploadCloud className="mx-auto text-[#a06e16]" size={24} />
              <input
                type="file"
                accept=".zip,application/zip"
                onChange={(event) => void handleSlideImagesSelect(event.target.files?.[0] || null)}
                className="mt-3 block w-full text-sm text-[#69757e]"
                required
              />
              {slideImagesZip ? (
                <p className="mt-2 text-sm font-medium text-emerald-700">
                  Ready — {slideImagesZip.name} matches {parsedSlides.length} slides.
                </p>
              ) : (
                <p className="mt-2 text-xs text-[#69757e]">
                  PNG, JPEG, and WebP slide images are supported.
                </p>
              )}
            </div>
          </BuilderField>
        ) : null}

        {parsedSlides ? (
          <div className="space-y-3 rounded-2xl border border-[#10283f]/10 bg-white px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#10283f]">Additional chapters</p>
                <p className="text-xs text-[#69757e]">
                  Add more PowerPoint files to build a multi-chapter class.
                </p>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[#10283f]/15 px-3 py-1.5 text-xs font-semibold text-[#10283f]">
                <Plus size={14} />
                Add chapter
                <input
                  type="file"
                  accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                  className="hidden"
                  onChange={(event) => {
                    void handleExtraChapterSelect(event.target.files?.[0] || null);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
            </div>
            {extraChapters.length ? (
              <ul className="space-y-2">
                {extraChapters.map((chapter, index) => (
                  <li
                    key={`${chapter.file.name}-${index}`}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#faf8f3] px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-[#10283f]">
                        Chapter {index + 2}: {chapter.title}
                      </p>
                      <p className="text-xs text-[#69757e]">
                        {chapter.parsedSlides.length} slides · {chapter.slideImagesZip ? "images ready" : "images needed"}
                      </p>
                    </div>
                    <label className="cursor-pointer rounded-full border border-[#10283f]/15 px-3 py-1.5 text-xs font-semibold text-[#10283f]">
                      {chapter.slideImagesZip ? "Replace image ZIP" : "Add image ZIP"}
                      <input
                        type="file"
                        accept=".zip,application/zip"
                        className="hidden"
                        onChange={(event) => {
                          void handleExtraChapterImages(index, event.target.files?.[0] || null);
                          event.currentTarget.value = "";
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setExtraChapters((current) => current.filter((_, itemIndex) => itemIndex !== index))
                      }
                      className="text-[#69757e] transition hover:text-red-600"
                      aria-label={`Remove chapter ${chapter.title}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-5 md:grid-cols-2">
          <BuilderField label="Course Name">
            <BuilderInput
              value={config.knowledge.courseName}
              onChange={(event) => updateKnowledge("courseName", event.target.value)}
              placeholder="Forklift Safety Classroom"
              required
            />
          </BuilderField>
          <BuilderField label="Estimated Duration (minutes)">
            <BuilderInput
              type="number"
              min={10}
              max={600}
              value={config.knowledge.estimatedMinutes}
              onChange={(event) =>
                updateKnowledge("estimatedMinutes", Number(event.target.value) || 45)
              }
            />
          </BuilderField>
        </div>

        <BuilderField label="Description">
          <BuilderTextarea
            rows={3}
            value={config.knowledge.description}
            onChange={(event) => updateKnowledge("description", event.target.value)}
            placeholder="What will learners be able to do after this class?"
          />
        </BuilderField>

        <div className="grid gap-5 md:grid-cols-2">
          <BuilderField label="Difficulty">
            <BuilderRadioGroup
              name="difficulty"
              value={config.knowledge.difficulty}
              options={[
                { id: "beginner", label: "Beginner" },
                { id: "intermediate", label: "Intermediate" },
                { id: "advanced", label: "Advanced" },
              ]}
              onChange={(value) => updateKnowledge("difficulty", value)}
            />
          </BuilderField>
          <BuilderField label="Passing Score (%)">
            <BuilderInput
              type="number"
              min={50}
              max={100}
              value={config.knowledge.passingScore}
              onChange={(event) =>
                updateKnowledge("passingScore", Number(event.target.value) || 80)
              }
            />
          </BuilderField>
        </div>

        <BuilderSubheading>Learning Objectives</BuilderSubheading>
        <div className="space-y-3">
          {config.knowledge.objectives.map((objective, index) => (
            <div key={`objective-${index}`} className="flex gap-2">
              <BuilderInput
                value={objective}
                onChange={(event) => updateObjective(index, event.target.value)}
                placeholder={`Objective ${index + 1}`}
              />
              <button
                type="button"
                onClick={() => removeObjective(index)}
                disabled={config.knowledge.objectives.length <= 1}
                className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-[#10283f]/10 text-[#69757e] disabled:opacity-30"
                aria-label="Remove objective"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addObjective}
            className="inline-flex items-center gap-2 rounded-xl border border-[#10283f]/10 px-4 py-2 text-sm font-semibold text-[#10283f]"
          >
            <Plus size={16} />
            Add objective
          </button>
        </div>

        <BuilderField label="Additional Resources (Optional)">
          <BuilderTextarea
            rows={3}
            value={config.knowledge.additionalResources}
            onChange={(event) =>
              updateKnowledge("additionalResources", event.target.value)
            }
            placeholder="Links, manuals, job aids, or reference material the AI may mention."
          />
        </BuilderField>
      </BuilderSection>

      <section className="rounded-3xl border border-[#10283f]/10 bg-[#fff9eb] p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-[#a06e16]">
          Teaching intensity
        </p>
        <h2 className="mt-1 font-serif text-2xl font-semibold text-[#10283f]">
          Start with a sensible preset
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-[#69757e]">
          Pick the overall teaching intensity. The recommended Balanced preset works for most
          courses, so you only need advanced controls when a lesson has special requirements.
        </p>
        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          {CLASSROOM_BUILDER_PRESETS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => applyPreset(option.id)}
              className={`rounded-2xl border p-4 text-left transition ${
                preset === option.id
                  ? "border-[#c68b1b] bg-white ring-2 ring-[#e8c273]/25"
                  : "border-[#10283f]/10 bg-white/70 hover:bg-white"
              }`}
            >
              <p className="font-bold text-[#10283f]">{option.label}</p>
              <p className="mt-2 text-sm leading-6 text-[#69757e]">{option.description}</p>
            </button>
          ))}
        </div>
      </section>

      <BuilderSection number={2} title="AI Teaching Preferences">
        <BuilderSubheading>Teaching Style</BuilderSubheading>
        <BuilderRadioGroup
          name="teachingStyle"
          value={config.teaching.style}
          options={TEACHING_STYLES}
          onChange={(value) => updateTeaching("style", value)}
        />

        <BuilderSubheading>Interaction Level</BuilderSubheading>
        <BuilderRadioGroup
          name="interactionLevel"
          value={config.teaching.interactionLevel}
          options={INTERACTION_LEVELS}
          onChange={(value) => updateTeaching("interactionLevel", value)}
        />

        <BuilderSubheading>AI Personality</BuilderSubheading>
        <BuilderRadioGroup
          name="personality"
          value={config.teaching.personality}
          options={AI_PERSONALITIES}
          onChange={(value) => updateTeaching("personality", value)}
        />

        <BuilderSubheading>Voice</BuilderSubheading>
        <div className="grid gap-5 md:grid-cols-3">
          <BuilderField label="Voice">
            <select
              value={config.teaching.voice}
              onChange={(event) => updateTeaching("voice", event.target.value)}
              className="w-full rounded-xl border border-[#10283f]/15 px-4 py-3 outline-none focus:border-[#c68b1b]"
            >
              {VOICE_OPTIONS.map((voice) => (
                <option key={voice.id} value={voice.id}>
                  {voice.label}
                </option>
              ))}
            </select>
          </BuilderField>
          <BuilderField label="Speed">
            <BuilderInput
              type="number"
              min={0.75}
              max={1.25}
              step={0.01}
              value={config.teaching.voiceSpeed}
              onChange={(event) =>
                updateTeaching("voiceSpeed", Number(event.target.value) || 0.96)
              }
            />
          </BuilderField>
          <BuilderField label="Accent">
            <select
              value={config.teaching.accent}
              onChange={(event) => updateTeaching("accent", event.target.value)}
              className="w-full rounded-xl border border-[#10283f]/15 px-4 py-3 outline-none focus:border-[#c68b1b]"
            >
              {ACCENT_OPTIONS.map((accent) => (
                <option key={accent.id} value={accent.id}>
                  {accent.label}
                </option>
              ))}
            </select>
          </BuilderField>
        </div>

        <BuilderSubheading>Read Bullet Points</BuilderSubheading>
        <BuilderRadioGroup
          name="readBulletPoints"
          value={config.teaching.readBulletPoints}
          options={[
            { id: "never", label: "Never" },
            { id: "when-important", label: "When Important" },
            { id: "always", label: "Always" },
          ]}
          onChange={(value) => updateTeaching("readBulletPoints", value)}
        />
      </BuilderSection>

      <details className="group rounded-3xl border border-[#10283f]/10 bg-white shadow-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 [&::-webkit-details-marker]:hidden">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[#a06e16]">
              Optional
            </p>
            <p className="mt-1 text-lg font-bold text-[#10283f]">Advanced lesson controls</p>
            <p className="mt-1 text-sm text-[#69757e]">
              Activities, visual tools, assessments, adaptation, and conversation rules.
            </p>
          </div>
          <span className="rounded-full bg-[#faf8f3] px-3 py-1.5 text-xs font-bold text-[#69757e] group-open:hidden">
            Show settings
          </span>
          <span className="hidden rounded-full bg-[#faf8f3] px-3 py-1.5 text-xs font-bold text-[#69757e] group-open:inline">
            Hide settings
          </span>
        </summary>
        <div className="space-y-6 border-t border-[#10283f]/10 bg-[#faf8f3]/50 p-4 sm:p-6">
      <BuilderSection number={3} title="Learning Activities">
        <p className="text-sm leading-6 text-[#69757e]">
          Choose which activity types the AI instructor may use during the lesson.
        </p>
        <BuilderCheckboxGrid
          options={ACTIVITY_OPTIONS}
          values={config.activities}
          maxSelected={CLASSROOM_BUILDER_LIMITS.activities}
          hint="Pick the few activity types that fit this lesson best."
          onChange={(id, checked) => toggleFlag("activities", id, checked)}
        />
      </BuilderSection>

      <BuilderSection number={4} title="Presentation Tools">
        <p className="text-sm leading-6 text-[#69757e]">
          Choose how the AI may present visuals in the center panel.
        </p>
        <BuilderCheckboxGrid
          options={PRESENTATION_OPTIONS}
          values={config.presentation}
          maxSelected={CLASSROOM_BUILDER_LIMITS.presentation}
          hint="A small set of visual tools keeps the screen clear."
          onChange={(id, checked) => toggleFlag("presentation", id, checked)}
        />
      </BuilderSection>

      <BuilderSection number={5} title="Student Experience">
        <BuilderCheckboxGrid
          options={STUDENT_EXPERIENCE_OPTIONS}
          values={config.studentExperience}
          maxSelected={CLASSROOM_BUILDER_LIMITS.studentExperience}
          hint="Choose the teaching behaviors that matter most for this audience."
          onChange={(id, checked) => toggleFlag("studentExperience", id, checked)}
        />
      </BuilderSection>

      <BuilderSection number={6} title="Formative Assessment">
        <BuilderSubheading>Frequency</BuilderSubheading>
        <BuilderRadioGroup
          name="formativeFrequency"
          value={config.formative.frequency}
          options={[
            { id: "rare", label: "Rare" },
            { id: "moderate", label: "Moderate" },
            { id: "frequent", label: "Frequent" },
            { id: "very-frequent", label: "Very Frequent" },
          ]}
          onChange={(value) =>
            setConfig((current) => ({
              ...current,
              formative: { ...current.formative, frequency: value },
            }))
          }
        />
        <BuilderSubheading>Allow</BuilderSubheading>
        <BuilderCheckboxGrid
          options={FORMATIVE_ALLOW_OPTIONS}
          values={config.formative.allow}
          maxSelected={CLASSROOM_BUILDER_LIMITS.formativeAllow}
          onChange={(id, checked) => toggleFlag("formativeAllow", id, checked)}
        />
      </BuilderSection>

      <BuilderSection number={7} title="Summative Assessment">
        <BuilderSubheading>Assessment Types</BuilderSubheading>
        <BuilderCheckboxGrid
          options={SUMMATIVE_TYPE_OPTIONS}
          values={config.summative.types}
          maxSelected={CLASSROOM_BUILDER_LIMITS.summativeTypes}
          onChange={(id, checked) => toggleFlag("summativeTypes", id, checked)}
        />
        <div className="grid gap-5 md:grid-cols-2">
          <label className="flex items-center gap-3 rounded-xl border border-[#10283f]/10 px-4 py-3 text-sm">
            <input
              type="checkbox"
              checked={config.summative.randomizeQuestions}
              onChange={(event) =>
                setConfig((current) => ({
                  ...current,
                  summative: {
                    ...current.summative,
                    randomizeQuestions: event.target.checked,
                  },
                }))
              }
              className="accent-[#c68b1b]"
            />
            Randomize Questions
          </label>
          <label className="flex items-center gap-3 rounded-xl border border-[#10283f]/10 px-4 py-3 text-sm">
            <input
              type="checkbox"
              checked={config.summative.requireMastery}
              onChange={(event) =>
                setConfig((current) => ({
                  ...current,
                  summative: {
                    ...current.summative,
                    requireMastery: event.target.checked,
                  },
                }))
              }
              className="accent-[#c68b1b]"
            />
            Require Mastery
          </label>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <BuilderField label="Passing Score (%)">
            <BuilderInput
              type="number"
              min={50}
              max={100}
              value={config.summative.passingScore}
              onChange={(event) =>
                setConfig((current) => ({
                  ...current,
                  summative: {
                    ...current.summative,
                    passingScore: Number(event.target.value) || 80,
                  },
                }))
              }
            />
          </BuilderField>
          <BuilderField label="Retake Rules">
            <select
              value={config.summative.retakeRule}
              onChange={(event) =>
                setConfig((current) => ({
                  ...current,
                  summative: {
                    ...current.summative,
                    retakeRule: event.target.value as ClassroomBuilderConfig["summative"]["retakeRule"],
                  },
                }))
              }
              className="w-full rounded-xl border border-[#10283f]/15 px-4 py-3 outline-none focus:border-[#c68b1b]"
            >
              <option value="unlimited">Unlimited retakes</option>
              <option value="twice">Up to 2 retakes</option>
              <option value="once">One retake</option>
              <option value="none">No retakes</option>
            </select>
          </BuilderField>
        </div>
      </BuilderSection>

      <BuilderSection number={8} title="AI Adaptation">
        <BuilderSubheading>If Student Struggles</BuilderSubheading>
        <BuilderCheckboxGrid
          options={STRUGGLE_OPTIONS}
          values={config.adaptation.ifStruggles}
          maxSelected={CLASSROOM_BUILDER_LIMITS.struggles}
          onChange={(id, checked) => toggleFlag("struggles", id, checked)}
        />
        <BuilderSubheading>If Student Excels</BuilderSubheading>
        <BuilderCheckboxGrid
          options={EXCEL_OPTIONS}
          values={config.adaptation.ifExcels}
          maxSelected={CLASSROOM_BUILDER_LIMITS.excels}
          onChange={(id, checked) => toggleFlag("excels", id, checked)}
        />
      </BuilderSection>

      <BuilderSection number={9} title="Course Settings">
        <BuilderSubheading>Conversation Mode</BuilderSubheading>
        <BuilderRadioGroup
          name="conversationMode"
          value={config.settings.conversationMode}
          options={[
            { id: "interrupt-anytime", label: "Student Can Interrupt Anytime" },
            { id: "raise-hand", label: "Raise Hand Before Asking" },
            { id: "checkpoints-only", label: "Questions At Checkpoints" },
          ]}
          onChange={(value) =>
            setConfig((current) => ({
              ...current,
              settings: { ...current.settings, conversationMode: value },
            }))
          }
        />
        <BuilderSubheading>Speech</BuilderSubheading>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex items-center gap-3 rounded-xl border border-[#10283f]/10 px-4 py-3 text-sm">
            <input
              type="checkbox"
              checked={config.settings.speechVoice}
              onChange={(event) =>
                setConfig((current) => ({
                  ...current,
                  settings: { ...current.settings, speechVoice: event.target.checked },
                }))
              }
              className="accent-[#c68b1b]"
            />
            Instructor voice
          </label>
          <label className="flex items-center gap-3 rounded-xl border border-[#10283f]/10 px-4 py-3 text-sm">
            <input
              type="checkbox"
              checked={config.settings.bookmarks}
              onChange={(event) =>
                setConfig((current) => ({
                  ...current,
                  settings: { ...current.settings, bookmarks: event.target.checked },
                }))
              }
              className="accent-[#c68b1b]"
            />
            Allow Resume Later
          </label>
        </div>
      </BuilderSection>
        </div>
      </details>

      <BuilderSection number={3} title="Publish">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <SummaryCard label="Knowledge Package" value={file?.name || "No file selected"} />
          <SummaryCard
            label="Estimated Course Length"
            value={`${estimates.courseLengthMinutes} minutes`}
          />
          <SummaryCard
            label="Estimated AI Cost / Student"
            value={`$${estimates.aiCostPerStudentUsd.toFixed(2)}`}
          />
          <SummaryCard
            label="Estimated Activities"
            value={String(estimates.activityCount)}
          />
          <SummaryCard
            label="Formative Assessments"
            value={String(estimates.formativeCount)}
          />
          <SummaryCard
            label="Final Assessment Length"
            value={`${estimates.finalAssessmentQuestions} questions`}
          />
        </div>

        {error ? (
          <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        ) : null}
        {submitting && uploadProgress ? (
          <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
            {uploadProgress}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={submitting || !file || !slideImagesZip || !parsedSlides?.length || !config.knowledge.courseName.trim() || parsingFile || extraChapters.some((chapter) => !chapter.slideImagesZip)}
            onClick={(event) => void onSubmit(event, "draft")}
            className="inline-flex items-center gap-2 rounded-2xl border border-[#10283f]/15 px-5 py-3 font-semibold text-[#10283f] disabled:opacity-40"
          >
            {submitting ? <LoaderCircle className="animate-spin" size={18} /> : null}
            Save draft
          </button>
          <button
            type="button"
            disabled={submitting || !file || !slideImagesZip || !parsedSlides?.length || !config.knowledge.courseName.trim() || parsingFile || extraChapters.some((chapter) => !chapter.slideImagesZip)}
            onClick={(event) => void onSubmit(event, "publish")}
            className="inline-flex items-center gap-2 rounded-2xl bg-[#10283f] px-5 py-3 font-semibold text-white disabled:opacity-40"
          >
            {submitting ? <LoaderCircle className="animate-spin" size={18} /> : null}
            Publish
          </button>
        </div>

        {result ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <p className="font-bold text-emerald-900">
              {result.course.title} {result.published ? "published" : "saved as draft"} (
              {result.slideCount} slides).
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href={result.previewUrl}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
              >
                <Eye size={16} />
                Preview lesson
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
      </BuilderSection>
    </form>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#10283f]/10 bg-[#faf8f3] px-4 py-4">
      <p className="text-xs font-bold uppercase tracking-[.14em] text-[#69757e]">{label}</p>
      <p className="mt-2 text-sm font-semibold leading-6 text-[#10283f]">{value}</p>
    </div>
  );
}
