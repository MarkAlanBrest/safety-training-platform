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
  ClassroomBuilderConfig,
  EXCEL_OPTIONS,
  FORMATIVE_ALLOW_OPTIONS,
  INTERACTION_LEVELS,
  PRESENTATION_OPTIONS,
  STRUGGLE_OPTIONS,
  STUDENT_EXPERIENCE_OPTIONS,
  SUMMATIVE_TYPE_OPTIONS,
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

type SubmitMode = "draft" | "publish";

export default function CourseBuilderForm() {
  const [config, setConfig] = useState<ClassroomBuilderConfig>(
    defaultClassroomBuilderConfig(),
  );
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    previewUrl: string;
    adminUrl: string;
    slideCount: number;
    course: { title: string; slug: string };
    published: boolean;
  } | null>(null);

  const slideCountEstimate = file ? Math.max(4, Math.round(file.size / 120_000)) : 8;
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
      if (section === "formativeAllow") {
        return {
          ...current,
          formative: {
            ...current.formative,
            allow: { ...current.formative.allow, [id]: checked },
          },
        };
      }
      if (section === "summativeTypes") {
        return {
          ...current,
          summative: {
            ...current.summative,
            types: { ...current.summative.types, [id]: checked },
          },
        };
      }
      if (section === "struggles") {
        return {
          ...current,
          adaptation: {
            ...current.adaptation,
            ifStruggles: { ...current.adaptation.ifStruggles, [id]: checked },
          },
        };
      }
      if (section === "excels") {
        return {
          ...current,
          adaptation: {
            ...current.adaptation,
            ifExcels: { ...current.adaptation.ifExcels, [id]: checked },
          },
        };
      }
      return { ...current, [section]: { ...current[section], [id]: checked } };
    });
  }

  async function onSubmit(event: FormEvent, mode: SubmitMode) {
    event.preventDefault();
    if (!file || !config.knowledge.courseName.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const form = new FormData();
      form.set("title", config.knowledge.courseName.trim());
      form.set("description", config.knowledge.description.trim());
      form.set("published", mode === "publish" ? "true" : "false");
      form.set("config", JSON.stringify(config));
      form.set("pptx", file);
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
      <BuilderSection number={1} title="Knowledge Package">
        <BuilderField label="Upload PowerPoint (.pptx)">
          <div className="rounded-2xl border border-dashed border-[#10283f]/20 bg-[#faf8f3] px-5 py-8 text-center">
            <UploadCloud className="mx-auto text-[#a06e16]" size={28} />
            <input
              type="file"
              accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
              className="mt-4 block w-full text-sm text-[#69757e]"
              required
            />
            {file ? (
              <p className="mt-2 text-sm font-medium text-[#10283f]">{file.name}</p>
            ) : null}
          </div>
        </BuilderField>

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

      <BuilderSection number={3} title="Learning Activities">
        <p className="text-sm leading-6 text-[#69757e]">
          Choose which activity types the AI instructor may use during the lesson.
        </p>
        <BuilderCheckboxGrid
          options={ACTIVITY_OPTIONS}
          values={config.activities}
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
          onChange={(id, checked) => toggleFlag("presentation", id, checked)}
        />
      </BuilderSection>

      <BuilderSection number={5} title="Student Experience">
        <BuilderCheckboxGrid
          options={STUDENT_EXPERIENCE_OPTIONS}
          values={config.studentExperience}
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
          onChange={(id, checked) => toggleFlag("formativeAllow", id, checked)}
        />
      </BuilderSection>

      <BuilderSection number={7} title="Summative Assessment">
        <BuilderSubheading>Assessment Types</BuilderSubheading>
        <BuilderCheckboxGrid
          options={SUMMATIVE_TYPE_OPTIONS}
          values={config.summative.types}
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
          onChange={(id, checked) => toggleFlag("struggles", id, checked)}
        />
        <BuilderSubheading>If Student Excels</BuilderSubheading>
        <BuilderCheckboxGrid
          options={EXCEL_OPTIONS}
          values={config.adaptation.ifExcels}
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
              checked={config.settings.speechText}
              onChange={(event) =>
                setConfig((current) => ({
                  ...current,
                  settings: { ...current.settings, speechText: event.target.checked },
                }))
              }
              className="accent-[#c68b1b]"
            />
            Text
          </label>
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
            Voice
          </label>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex items-center gap-3 rounded-xl border border-[#10283f]/10 px-4 py-3 text-sm">
            <input
              type="checkbox"
              checked={config.settings.captions}
              onChange={(event) =>
                setConfig((current) => ({
                  ...current,
                  settings: { ...current.settings, captions: event.target.checked },
                }))
              }
              className="accent-[#c68b1b]"
            />
            Captions On
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

      <BuilderSection number={10} title="Publish">
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

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={submitting || !file || !config.knowledge.courseName.trim()}
            onClick={(event) => void onSubmit(event, "draft")}
            className="inline-flex items-center gap-2 rounded-2xl border border-[#10283f]/15 px-5 py-3 font-semibold text-[#10283f] disabled:opacity-40"
          >
            {submitting ? <LoaderCircle className="animate-spin" size={18} /> : null}
            Save draft
          </button>
          <button
            type="button"
            disabled={submitting || !file || !config.knowledge.courseName.trim()}
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
