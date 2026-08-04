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
  AI_PERSONALITIES,
  ClassroomBuilderConfig,
  INTERACTION_LEVELS,
  PPT_ACTIVITY_OPTIONS,
  TEACHING_STYLES,
  VOICE_OPTIONS,
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

type SubmitMode = "draft" | "publish";

type ChapterDraft = {
  file: File;
  title: string;
  parsedSlides: ParsedClassroomSlide[];
};

export default function CourseBuilderForm() {
  const [config, setConfig] = useState<ClassroomBuilderConfig>(
    defaultClassroomBuilderConfig(),
  );
  const [file, setFile] = useState<File | null>(null);
  const [parsedSlides, setParsedSlides] = useState<ParsedClassroomSlide[] | null>(null);
  const [extraChapters, setExtraChapters] = useState<ChapterDraft[]>([]);
  const [parsingFile, setParsingFile] = useState(false);
  const [parseProgress, setParseProgress] = useState("");
  const [submitting, setSubmitting] = useState(false);
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

  function toggleActivity(id: string, checked: boolean) {
    setConfig((current) => ({
      ...current,
      activities: { ...current.activities, [id]: checked },
    }));
  }

  function updatePassingScore(score: number) {
    setConfig((current) => ({
      ...current,
      knowledge: { ...current.knowledge, passingScore: score },
      summative: { ...current.summative, passingScore: score },
    }));
  }

  async function handleFileSelect(selected: File | null) {
    setFile(selected);
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

  async function onSubmit(event: FormEvent, mode: SubmitMode) {
    event.preventDefault();
    if (!file || !parsedSlides?.length || !config.knowledge.courseName.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const chapters = [
        { file, title: config.knowledge.courseName.trim(), parsedSlides },
        ...extraChapters,
      ];
      const form =
        chapters.length > 1
          ? buildMultiChapterUploadFormData(chapters, {
              title: config.knowledge.courseName.trim(),
              description: config.knowledge.description.trim(),
              published: mode === "publish",
              config,
            })
          : buildClassroomUploadFormData(file, parsedSlides, {
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
      setResult(data);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Course could not be created.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="space-y-6">
      <BuilderSection number={1} title="PowerPoint & Course Details">
        <BuilderField
          label="Upload PowerPoint (.pptx)"
          hint="Up to 25 MB per deck. Slides display exactly as uploaded. Add speaker notes in PowerPoint — the AI teacher uses them to guide the lesson."
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
                  <p className="text-emerald-700">
                    Ready — {parsedSlides.length} slide
                    {parsedSlides.length === 1 ? "" : "s"} prepared for upload.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </BuilderField>

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
                    className="flex items-center justify-between gap-3 rounded-xl bg-[#faf8f3] px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-[#10283f]">
                        Chapter {index + 2}: {chapter.title}
                      </p>
                      <p className="text-xs text-[#69757e]">
                        {chapter.parsedSlides.length} slides
                      </p>
                    </div>
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
      </BuilderSection>

      <BuilderSection number={2} title="AI Instructor">
        <p className="text-sm leading-6 text-[#69757e]">
          Configure how the AI teaches from your speaker notes. Slides are never redesigned —
          the instructor explains them conversationally.
        </p>

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
        <div className="grid gap-5 md:grid-cols-2">
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
        </div>
      </BuilderSection>

      <BuilderSection number={3} title="Activities & Assessment">
        <p className="text-sm leading-6 text-[#69757e]">
          The AI inserts these activity types between slides. Your PowerPoint stays on screen
          during teaching; activities appear at checkpoints.
        </p>

        <BuilderSubheading>Activity Types</BuilderSubheading>
        <BuilderCheckboxGrid
          options={PPT_ACTIVITY_OPTIONS}
          values={config.activities}
          maxSelected={PPT_ACTIVITY_OPTIONS.length}
          hint="Choose which checkpoint activities to include."
          onChange={(id, checked) => toggleActivity(id, checked)}
        />

        <BuilderSubheading>Checkpoint Frequency</BuilderSubheading>
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

        <BuilderSubheading>Final Assessment</BuilderSubheading>
        <div className="grid gap-5 md:grid-cols-2">
          <BuilderField label="Passing Score (%)">
            <BuilderInput
              type="number"
              min={50}
              max={100}
              value={config.summative.passingScore}
              onChange={(event) =>
                updatePassingScore(Number(event.target.value) || 80)
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

      <BuilderSection number={4} title="Student Experience & Publish">
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
          Instructor voice (text-to-speech)
        </label>
        <p className="text-xs text-[#69757e]">
          Students can type or use their microphone to respond — speech-to-text is always on.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <SummaryCard
            label="Slides"
            value={parsedSlides ? String(slideCountEstimate) : "Upload a deck"}
          />
          <SummaryCard
            label="Estimated Length"
            value={`${estimates.courseLengthMinutes} minutes`}
          />
        </div>

        {error ? (
          <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={submitting || !file || !parsedSlides?.length || !config.knowledge.courseName.trim() || parsingFile}
            onClick={(event) => void onSubmit(event, "draft")}
            className="inline-flex items-center gap-2 rounded-2xl border border-[#10283f]/15 px-5 py-3 font-semibold text-[#10283f] disabled:opacity-40"
          >
            {submitting ? <LoaderCircle className="animate-spin" size={18} /> : null}
            Save draft
          </button>
          <button
            type="button"
            disabled={submitting || !file || !parsedSlides?.length || !config.knowledge.courseName.trim() || parsingFile}
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
