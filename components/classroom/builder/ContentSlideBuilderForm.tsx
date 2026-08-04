"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ClipboardCheck,
  ImagePlus,
  LoaderCircle,
  MessageSquare,
  Plus,
  Trash2,
  UploadCloud,
} from "lucide-react";
import {
  AI_PERSONALITIES,
  ClassroomBuilderConfig,
  TEACHING_STYLES,
  VOICE_OPTIONS,
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
import { extractImagesFromZip } from "@/lib/ppt-slide-images";
import {
  completeClassroomAssetUpload,
  uploadClassroomAsset,
} from "@/lib/classroom-asset-upload-client";
import { classroomChapterSlideAssetPath } from "@/lib/classroom-chapters";
import {
  emptyActivity,
  emptyContentSlide,
  emptyFormative,
  type LessonLineupItem,
  type LineupActivity,
  type LineupContentSlide,
  type LineupFormative,
} from "@/lib/classroom-lineup";

type SubmitMode = "draft" | "publish";

type ContentSlideDraft = LineupContentSlide & {
  imageFile?: File;
  previewUrl?: string;
};

type LineupDraftItem =
  | ContentSlideDraft
  | LineupFormative
  | LineupActivity;

function isContentSlide(item: LineupDraftItem): item is ContentSlideDraft {
  return item.kind === "content";
}

export default function ContentSlideBuilderForm() {
  const [config, setConfig] = useState<ClassroomBuilderConfig>(defaultClassroomBuilderConfig());
  const [lineup, setLineup] = useState<LineupDraftItem[]>([emptyContentSlide("Slide 1")]);
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);
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
      if (!isContentSlide(item)) return true;
      return Boolean(item.imageFile) && item.teachingContent.trim().length > 0;
    });
  }, [config.knowledge.courseName, contentSlideCount, lineup]);

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

  function updateFormative(index: number, patch: Partial<LineupFormative>) {
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

  async function handleBulkZipImport(file: File | null) {
    if (!file) return;
    setImporting(true);
    setError("");
    try {
      const images = extractImagesFromZip(new Uint8Array(await file.arrayBuffer()));
      const imported: ContentSlideDraft[] = images.map((image, index) => {
        const blob = new Blob([new Uint8Array(image.bytes)], { type: image.mimeType });
        const imageFile = new File([blob], `slide-${index + 1}.jpg`, { type: image.mimeType });
        return {
          ...emptyContentSlide(`Slide ${lineup.filter(isContentSlide).length + index + 1}`),
          imageFile,
          previewUrl: URL.createObjectURL(blob),
        };
      });
      updateLineup((current) => [...current.filter((item) => !isContentSlide(item) || item.imageFile), ...imported]);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Could not import slide images.");
    } finally {
      setImporting(false);
    }
  }

  function handleImageSelect(index: number, file: File | null) {
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    updateContentSlide(index, { imageFile: file, previewUrl });
  }

  async function onSubmit(event: FormEvent, mode: SubmitMode) {
    event.preventDefault();
    if (!canSubmit) {
      setError("Add slide images and teaching notes for every content slide before continuing.");
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
            teachingContent: item.teachingContent.trim(),
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
            flashcards: item.flashcards,
            dragItems: item.dragItems,
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

      const response = await fetch("/api/classroom/content-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: config.knowledge.courseName.trim(),
          description: config.knowledge.description.trim(),
          published: mode === "publish",
          config,
          lineup: payloadLineup,
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
            Build your lesson in order. Each <strong>content slide</strong> pairs a slide image with
            teaching notes for the AI. Need a zoom or a circle? Add a separate slide image in
            PowerPoint with that view already baked in.
          </p>
          <p className="mt-2">
            Insert <strong>formative checks</strong> or <strong>activities</strong> anywhere in the
            sequence.
          </p>
        </div>

        <BuilderField
          label="Import slide images from ZIP"
          hint="Export slides from PowerPoint as PNG or JPEG, ZIP them, and import in order. You can still edit teaching notes after import."
        >
          <div className="rounded-2xl border border-dashed border-[#10283f]/20 bg-white px-5 py-5 text-center">
            <UploadCloud className="mx-auto text-[#a06e16]" size={24} />
            <input
              type="file"
              accept=".zip,application/zip"
              disabled={importing}
              onChange={(event) => void handleBulkZipImport(event.target.files?.[0] || null)}
              className="mt-3 block w-full text-sm text-[#69757e]"
            />
            {importing ? (
              <p className="mt-2 inline-flex items-center justify-center gap-2 text-sm text-[#69757e]">
                <LoaderCircle className="animate-spin" size={14} />
                Importing slide images…
              </p>
            ) : null}
          </div>
        </BuilderField>

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
                        onChange={(event) =>
                          updateFormative(index, {
                            type: event.target.value as LineupFormative["type"],
                          })
                        }
                        className="w-full rounded-xl border border-[#10283f]/15 px-4 py-3"
                      >
                        <option value="multipleChoice">Multiple choice</option>
                        <option value="exercise">Open exercise</option>
                        <option value="flashcard">Flash cards</option>
                        <option value="dragdrop">Drag & drop order</option>
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
            onClick={() => updateLineup((current) => [...current, emptyFormative()])}
            className="inline-flex items-center gap-2 rounded-full border border-[#10283f]/15 px-4 py-2 text-sm font-semibold text-[#10283f]"
          >
            <ClipboardCheck size={14} />
            Insert formative check
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

      <BuilderSection number={3} title="AI instructor">
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
        <BuilderField label="Voice">
          <select
            value={config.teaching.voice}
            onChange={(event) =>
              setConfig((current) => ({
                ...current,
                teaching: { ...current.teaching, voice: event.target.value },
              }))
            }
            className="w-full rounded-xl border border-[#10283f]/15 px-4 py-3"
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
