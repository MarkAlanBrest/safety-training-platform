"use client";

import Link from "next/link";
import Image from "next/image";
import { type DragEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  ExternalLink,
  FileText,
  GripVertical,
  ImagePlus,
  LayoutGrid,
  ListRestart,
  LoaderCircle,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import AdminShell from "@/components/AdminShell";
import VisualSlide, { isPictureSource } from "@/components/training/VisualSlide";
import { buildPlayerFrames, type LessonMoment, type LessonPlan } from "@/lib/mason";

type SectionResponse = {
  id: number;
  title: string;
  position: number;
  estimatedMinutes: number;
  lessonPlan: LessonPlan;
  course: {
    title: string;
    slug: string;
    updatedAt: string;
  };
};

type StringListProps = {
  values: string[];
  onChange: (values: string[]) => void;
  addLabel: string;
  placeholder: string;
};

function StringList({
  values,
  onChange,
  addLabel,
  placeholder,
}: StringListProps) {
  return (
    <div className="space-y-3">
      {values.map((value, index) => (
        <div key={index} className="flex gap-2">
          <input
            value={value}
            onChange={(event) =>
              onChange(
                values.map((item, itemIndex) =>
                  itemIndex === index ? event.target.value : item,
                ),
              )
            }
            placeholder={placeholder}
            className="min-w-0 flex-1 rounded-xl border border-[#10283f]/15 px-4 py-3"
          />
          <button
            type="button"
            onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))}
            className="grid h-12 w-12 place-items-center rounded-xl border border-red-200 text-red-700"
            aria-label={`Remove ${addLabel.toLowerCase()}`}
          >
            <Trash2 size={17} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...values, ""])}
        className="inline-flex items-center gap-2 rounded-xl border border-[#10283f]/15 px-4 py-2.5 text-sm font-bold text-[#10283f]"
      >
        <Plus size={16} /> {addLabel}
      </button>
    </div>
  );
}

function FieldLabel({
  children,
  optional = false,
}: {
  children: React.ReactNode;
  optional?: boolean;
}) {
  return (
    <span className="mb-2 block text-sm font-bold text-[#263746]">
      {children}
      {optional && <span className="ml-1 font-normal text-[#82909a]">(optional)</span>}
    </span>
  );
}

type AddableMomentKind =
  | "text"
  | "tiles"
  | "dragdrop"
  | "visual"
  | "question"
  | "scenario";

function createMoment(kind: AddableMomentKind): LessonMoment {
  const base: LessonMoment = {
    kind,
    phase: kind === "question" || kind === "scenario" || kind === "dragdrop" ? "activity" : "learn",
    title: "New content block",
    narration: "",
    prompt: null,
    choices: null,
    correctAnswer: null,
    feedback: null,
    pageNumber: null,
  };

  if (kind === "text") {
    return { ...base, title: "New text page" };
  }
  if (kind === "tiles") {
    return {
      ...base,
      title: "Three key ideas",
      tiles: [
        { title: "First idea", body: "Explain the first important point." },
        { title: "Second idea", body: "Explain the second important point." },
        { title: "Third idea", body: "Explain the third important point." },
      ],
    };
  }
  if (kind === "dragdrop") {
    return {
      ...base,
      title: "Put the steps in order",
      prompt: "Drag the steps into the correct order.",
      dragItems: ["First step", "Second step", "Third step"],
    };
  }
  if (kind === "visual") {
    return {
      ...base,
      title: "New visual explainer",
      explainerStyle: "flipbook",
      explainerFrames: [
        { title: "", caption: "", narration: "", visualItems: [] },
      ],
    };
  }
  if (kind === "question") {
    return {
      ...base,
      title: "Knowledge check",
      prompt: "Add the question here.",
      choices: ["First answer", "Second answer", "Third answer"],
      correctAnswer: 0,
    };
  }
  return {
    ...base,
    title: "Practice scenario",
    narration: "Describe the situation here.",
    prompt: "What should the learner do?",
    choices: ["First response", "Second response", "Third response"],
    correctAnswer: 0,
  };
}

function MomentEditor({
  moment,
  index,
  total,
  courseSlug,
  onChange,
  onMove,
  onRemove,
  onDragStart,
  onDrop,
}: {
  moment: LessonMoment;
  index: number;
  total: number;
  courseSlug: string;
  onChange: (moment: LessonMoment) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
  onDragStart: (event: DragEvent<HTMLDivElement>) => void;
  onDrop: (event: DragEvent<HTMLElement>) => void;
}) {
  const isChoiceActivity = moment.kind === "question" || moment.kind === "scenario";
  const isVisual = moment.kind === "visual";
  const isTiles = moment.kind === "tiles";
  const isDragDrop = moment.kind === "dragdrop";
  const playerFrames = buildPlayerFrames(moment);
  const hasPictures = playerFrames.some((frame) => isPictureSource(frame.image));

  function patch(values: Partial<LessonMoment>) {
    onChange({ ...moment, ...values });
  }

  function setFramePicture(frameIndex: number, file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      window.alert("Choose a PNG, JPEG, or WebP picture.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      window.alert("Pictures must be 4 MB or smaller.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      patch({
        explainerFrames: (moment.explainerFrames || []).map((item, itemIndex) =>
          itemIndex === frameIndex ? { ...item, sourceImage: reader.result as string } : item,
        ),
      });
    };
    reader.readAsDataURL(file);
  }

  return (
    <article
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
      className="overflow-hidden rounded-3xl border border-[#10283f]/10 bg-white shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#10283f]/10 bg-[#f3f5f5] px-5 py-4">
        <div className="flex items-center gap-3">
          <div
            draggable
            onDragStart={onDragStart}
            className="cursor-grab rounded-lg p-1 text-[#9aa4aa] active:cursor-grabbing"
            title="Drag to reorder"
          >
            <GripVertical size={19} />
          </div>
          <span className="grid h-8 w-8 place-items-center rounded-full bg-[#10283f] text-xs font-black text-white">
            {index + 1}
          </span>
          <div>
            <p className="text-xs font-black uppercase tracking-[.14em] text-[#9a6812]">
              {moment.kind}
            </p>
            <p className="text-sm font-bold text-[#10283f]">
              {moment.title || "Untitled moment"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={index === 0}
            onClick={() => onMove(-1)}
            className="grid h-9 w-9 place-items-center rounded-lg border border-[#10283f]/10 bg-white disabled:opacity-30"
            aria-label="Move up"
          >
            <ArrowUp size={16} />
          </button>
          <button
            type="button"
            disabled={index === total - 1}
            onClick={() => onMove(1)}
            className="grid h-9 w-9 place-items-center rounded-lg border border-[#10283f]/10 bg-white disabled:opacity-30"
            aria-label="Move down"
          >
            <ArrowDown size={16} />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="ml-2 grid h-9 w-9 place-items-center rounded-lg border border-red-200 bg-white text-red-700"
            aria-label="Delete teaching moment"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="grid gap-5 p-5 lg:grid-cols-2 lg:p-6">
        <label>
          <FieldLabel>Content type</FieldLabel>
          <select
            value={moment.kind}
            onChange={(event) =>
              patch({
                kind: event.target.value as LessonMoment["kind"],
                phase:
                  event.target.value === "question" ||
                  event.target.value === "scenario"
                    ? "activity"
                    : "learn",
              })
            }
            className="w-full rounded-xl border border-[#10283f]/15 bg-white px-4 py-3"
          >
            <option value="explain">Explanation</option>
            <option value="text">Text page</option>
            <option value="tiles">Three tiles</option>
            <option value="dragdrop">Drag to order</option>
            <option value="visual">Visual explainer</option>
            <option value="question">Question</option>
            <option value="scenario">Scenario</option>
            <option value="summary">Summary</option>
          </select>
        </label>
        <label>
          <FieldLabel>Learning phase</FieldLabel>
          <select
            value={moment.phase || "learn"}
            onChange={(event) =>
              patch({ phase: event.target.value as LessonMoment["phase"] })
            }
            className="w-full rounded-xl border border-[#10283f]/15 bg-white px-4 py-3"
          >
            <option value="learn">Learn</option>
            <option value="activity">Activity</option>
            <option value="mastery">Final mastery check</option>
          </select>
        </label>
        <label className="lg:col-span-2">
          <FieldLabel>Title</FieldLabel>
          <input
            value={moment.title}
            onChange={(event) => patch({ title: event.target.value })}
            className="w-full rounded-xl border border-[#10283f]/15 px-4 py-3"
          />
        </label>
        {!isVisual && (
          <label className="lg:col-span-2">
            <FieldLabel>Narration or teaching text</FieldLabel>
            <textarea
              value={moment.narration}
              onChange={(event) => patch({ narration: event.target.value })}
              rows={6}
              className="w-full resize-y rounded-xl border border-[#10283f]/15 px-4 py-3 leading-7"
            />
          </label>
        )}

        {isChoiceActivity && (
          <>
            <label className="lg:col-span-2">
              <FieldLabel>Question prompt</FieldLabel>
              <textarea
                value={moment.prompt || ""}
                onChange={(event) => patch({ prompt: event.target.value || null })}
                rows={2}
                className="w-full resize-y rounded-xl border border-[#10283f]/15 px-4 py-3"
              />
            </label>
            <div className="lg:col-span-2">
              <FieldLabel>Answer choices</FieldLabel>
              <div className="space-y-3">
                {(moment.choices || []).map((choice, choiceIndex) => (
                  <div key={choiceIndex} className="flex items-center gap-3">
                    <input
                      type="radio"
                      name={`correct-${index}`}
                      checked={moment.correctAnswer === choiceIndex}
                      onChange={() => patch({ correctAnswer: choiceIndex })}
                      className="h-4 w-4"
                      aria-label={`Mark answer ${choiceIndex + 1} correct`}
                    />
                    <input
                      value={choice}
                      onChange={(event) =>
                        patch({
                          choices: (moment.choices || []).map((item, itemIndex) =>
                            itemIndex === choiceIndex ? event.target.value : item,
                          ),
                        })
                      }
                      className="min-w-0 flex-1 rounded-xl border border-[#10283f]/15 px-4 py-3"
                      placeholder={`Answer ${choiceIndex + 1}`}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const choices = (moment.choices || []).filter(
                          (_, itemIndex) => itemIndex !== choiceIndex,
                        );
                        patch({
                          choices,
                          correctAnswer:
                            moment.correctAnswer === choiceIndex
                              ? null
                              : moment.correctAnswer !== null &&
                                  moment.correctAnswer > choiceIndex
                                ? moment.correctAnswer - 1
                                : moment.correctAnswer,
                        });
                      }}
                      className="grid h-11 w-11 place-items-center rounded-xl border border-red-200 text-red-700"
                      aria-label="Remove answer"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() =>
                  patch({ choices: [...(moment.choices || []), "New answer"] })
                }
                className="mt-3 inline-flex items-center gap-2 rounded-xl border border-[#10283f]/15 px-4 py-2 text-sm font-bold"
              >
                <Plus size={15} /> Add answer
              </button>
            </div>
            <label className="lg:col-span-2">
              <FieldLabel>Answer feedback</FieldLabel>
              <textarea
                value={moment.feedback || ""}
                onChange={(event) => patch({ feedback: event.target.value || null })}
                rows={3}
                className="w-full resize-y rounded-xl border border-[#10283f]/15 px-4 py-3"
              />
            </label>
          </>
        )}

        {isTiles && (
          <div className="lg:col-span-2">
            <FieldLabel>Tiles</FieldLabel>
            <div className="grid gap-4 lg:grid-cols-3">
              {(moment.tiles || []).map((tile, tileIndex) => (
                <div
                  key={tileIndex}
                  className="rounded-2xl border border-[#10283f]/10 bg-[#f8f9f9] p-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-[#9a6812]">
                      Tile {tileIndex + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        patch({
                          tiles: (moment.tiles || []).filter(
                            (_, itemIndex) => itemIndex !== tileIndex,
                          ),
                        })
                      }
                      className="text-red-700"
                      aria-label={`Delete tile ${tileIndex + 1}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <input
                    value={tile.title}
                    onChange={(event) =>
                      patch({
                        tiles: (moment.tiles || []).map((item, itemIndex) =>
                          itemIndex === tileIndex
                            ? { ...item, title: event.target.value }
                            : item,
                        ),
                      })
                    }
                    placeholder="Tile heading"
                    className="w-full rounded-xl border border-[#10283f]/15 bg-white px-3 py-2 font-bold"
                  />
                  <textarea
                    value={tile.body}
                    onChange={(event) =>
                      patch({
                        tiles: (moment.tiles || []).map((item, itemIndex) =>
                          itemIndex === tileIndex
                            ? { ...item, body: event.target.value }
                            : item,
                        ),
                      })
                    }
                    rows={4}
                    placeholder="Supporting text"
                    className="mt-3 w-full resize-y rounded-xl border border-[#10283f]/15 bg-white px-3 py-2 leading-6"
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() =>
                patch({
                  tiles: [
                    ...(moment.tiles || []),
                    { title: "New tile", body: "Add the supporting detail here." },
                  ],
                })
              }
              className="mt-3 inline-flex items-center gap-2 rounded-xl border border-[#10283f]/15 px-4 py-2 text-sm font-bold"
            >
              <Plus size={15} /> Add tile
            </button>
          </div>
        )}

        {isDragDrop && (
          <>
            <label className="lg:col-span-2">
              <FieldLabel>Activity instructions</FieldLabel>
              <textarea
                value={moment.prompt || ""}
                onChange={(event) => patch({ prompt: event.target.value || null })}
                rows={2}
                placeholder="Drag the steps into the correct order."
                className="w-full resize-y rounded-xl border border-[#10283f]/15 px-4 py-3"
              />
            </label>
            <div className="lg:col-span-2">
              <FieldLabel>Correct order</FieldLabel>
              <p className="mb-3 text-sm leading-6 text-[#64727b]">
                Enter the items in the correct sequence. Learners receive them out of order.
              </p>
              <StringList
                values={moment.dragItems || []}
                onChange={(dragItems) => patch({ dragItems })}
                addLabel="Add draggable item"
                placeholder="A step or item"
              />
            </div>
            <label className="lg:col-span-2">
              <FieldLabel optional>Completion feedback</FieldLabel>
              <textarea
                value={moment.feedback || ""}
                onChange={(event) => patch({ feedback: event.target.value || null })}
                rows={3}
                className="w-full resize-y rounded-xl border border-[#10283f]/15 px-4 py-3"
              />
            </label>
          </>
        )}

        {isVisual && (
          <div className="lg:col-span-2 space-y-5">
            <div className="overflow-hidden rounded-2xl border border-[#10283f]/10 bg-[#0b1218]">
              <p className="border-b border-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[.14em] text-white/60">
                Learner view — pictures and play bar only
              </p>
              <div className="p-3">
                {hasPictures ? (
                  <VisualSlide frames={playerFrames} courseSlug={courseSlug} />
                ) : (
                  <div className="grid aspect-video place-items-center bg-black px-6 text-center text-sm text-white/65">
                    No pictures are attached yet. Choose a picture for each voiceover below.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-[#10283f]/10 bg-[#f8f9f9] p-5">
              <p className="font-bold text-[#10283f]">Voiceover per picture</p>
              <p className="mt-1 text-sm leading-6 text-[#5f6d75]">
                Learners only see the pictures above. Edit the spoken narration for each
                picture here — titles, captions, and labels are not shown.
              </p>
              <div className="mt-4 space-y-4">
                {(moment.explainerFrames || []).map((frame, frameIndex) => (
                  <div
                    key={frameIndex}
                    className="rounded-2xl border border-[#10283f]/10 bg-white p-4"
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <span className="text-xs font-black uppercase tracking-wider text-[#9a6812]">
                        Picture {frameIndex + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          patch({
                            explainerFrames: (moment.explainerFrames || []).filter(
                              (_, itemIndex) => itemIndex !== frameIndex,
                            ),
                          })
                        }
                        className="text-red-700"
                        aria-label="Delete picture"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                      {frame.sourceImage ? (
                        <Image
                          src={frame.sourceImage}
                          alt={`Visual explainer picture ${frameIndex + 1}`}
                          width={160}
                          height={90}
                          unoptimized
                          className="aspect-video w-40 shrink-0 object-cover"
                        />
                      ) : (
                        <div className="grid aspect-video w-40 shrink-0 place-items-center bg-[#e8ecef] text-xs font-bold text-[#6b7780]">
                          No picture
                        </div>
                      )}
                      <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#10283f]/15 bg-white px-3 py-2 text-xs font-bold text-[#10283f]">
                        <ImagePlus size={15} />
                        {frame.sourceImage ? "Replace picture" : "Choose picture"}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="sr-only"
                          onChange={(event) => {
                            setFramePicture(frameIndex, event.target.files?.[0]);
                            event.target.value = "";
                          }}
                        />
                      </label>
                    </div>
                    <textarea
                      value={frame.narration}
                      onChange={(event) =>
                        patch({
                          explainerFrames: (moment.explainerFrames || []).map(
                            (item, itemIndex) =>
                              itemIndex === frameIndex
                                ? { ...item, narration: event.target.value }
                                : item,
                          ),
                        })
                      }
                      rows={3}
                      placeholder="Spoken narration for this picture"
                      className="w-full resize-y rounded-xl border border-[#10283f]/15 px-3 py-2 leading-7"
                    />
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() =>
                  patch({
                    explainerStyle: "flipbook",
                    explainerFrames: [
                      ...(moment.explainerFrames || []),
                      {
                        title: "",
                        caption: "",
                        narration: "",
                        visualItems: [],
                      },
                    ],
                  })
                }
                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[#10283f]/15 bg-white px-3 py-2 text-xs font-bold"
              >
                <Plus size={14} /> Add picture
              </button>
            </div>

            <details className="rounded-2xl border border-[#10283f]/10 bg-[#f8f9f9] p-5">
              <summary className="cursor-pointer text-sm font-bold text-[#10283f]">
                Advanced visual settings
              </summary>
              <div className="mt-5 grid gap-5 lg:grid-cols-2">
                <label>
                  <FieldLabel optional>Visual type</FieldLabel>
                  <select
                    value={moment.visualType || ""}
                    onChange={(event) =>
                      patch({
                        visualType:
                          (event.target.value as LessonMoment["visualType"]) || null,
                      })
                    }
                    className="w-full rounded-xl border border-[#10283f]/15 bg-white px-4 py-3"
                  >
                    <option value="">Not specified</option>
                    <option value="process">Process</option>
                    <option value="anatomy">Anatomy</option>
                    <option value="comparison">Comparison</option>
                    <option value="formula">Formula</option>
                    <option value="sequence">Sequence</option>
                  </select>
                </label>
                <label>
                  <FieldLabel optional>Source PDF page</FieldLabel>
                  <input
                    type="number"
                    min={1}
                    value={moment.pageNumber || ""}
                    onChange={(event) =>
                      patch({
                        pageNumber: event.target.value
                          ? Number(event.target.value)
                          : null,
                      })
                    }
                    className="w-full rounded-xl border border-[#10283f]/15 bg-white px-4 py-3"
                  />
                </label>
              </div>
            </details>
          </div>
        )}
      </div>
    </article>
  );
}

export default function SectionContentEditorPage() {
  const params = useParams<{ slug: string; id: string }>();
  const slug = params?.slug;
  const id = params?.id;
  const [section, setSection] = useState<SectionResponse | null>(null);
  const [sectionTitle, setSectionTitle] = useState("");
  const [estimatedMinutes, setEstimatedMinutes] = useState(15);
  const [plan, setPlan] = useState<LessonPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draggedMomentIndex, setDraggedMomentIndex] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!slug || !id) return;
    fetch(`/api/admin/courses/${slug}/sections/${id}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Section could not be loaded.");
        return data as SectionResponse;
      })
      .then((data) => {
        setSection(data);
        setSectionTitle(data.title);
        setEstimatedMinutes(data.estimatedMinutes || 15);
        setPlan(data.lessonPlan);
      })
      .catch((caught) =>
        setError(
          caught instanceof Error ? caught.message : "Section could not be loaded.",
        ),
      )
      .finally(() => setLoading(false));
  }, [slug, id]);

  function updateMoment(index: number, moment: LessonMoment) {
    if (!plan) return;
    setPlan({
      ...plan,
      moments: plan.moments.map((item, itemIndex) =>
        itemIndex === index ? moment : item,
      ),
    });
  }

  function moveMoment(index: number, direction: -1 | 1) {
    if (!plan) return;
    const destination = index + direction;
    if (destination < 0 || destination >= plan.moments.length) return;
    const moments = [...plan.moments];
    [moments[index], moments[destination]] = [
      moments[destination],
      moments[index],
    ];
    setPlan({ ...plan, moments });
  }

  function moveMomentTo(destination: number) {
    if (!plan || draggedMomentIndex === null || draggedMomentIndex === destination) {
      setDraggedMomentIndex(null);
      return;
    }
    const moments = [...plan.moments];
    const [moved] = moments.splice(draggedMomentIndex, 1);
    moments.splice(destination, 0, moved);
    setPlan({ ...plan, moments });
    setDraggedMomentIndex(null);
  }

  function addMoment(kind: AddableMomentKind) {
    if (!plan) return;
    setPlan({ ...plan, moments: [...plan.moments, createMoment(kind)] });
  }

  async function save() {
    if (!plan || !section) return;
    setSaving(true);
    setError("");
    setMessage("");
    const response = await fetch(
      `/api/admin/courses/${section.course.slug}/sections/${section.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: sectionTitle,
          estimatedMinutes,
          lessonPlan: plan,
        }),
      },
    );
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Changes could not be saved.");
    } else {
      setSection(data);
      setPlan(data.lessonPlan);
      setSectionTitle(data.title);
      setEstimatedMinutes(data.estimatedMinutes || 15);
      setMessage("Section content saved.");
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#edf1f2]">
        <LoaderCircle className="animate-spin text-[#a06e16]" size={32} />
      </main>
    );
  }

  if (!section || !plan) {
    return <main className="p-10 text-red-700">{error || "Section not found."}</main>;
  }

  return (
    <AdminShell
      title={`Edit: ${section.title}`}
      eyebrow={`${section.course.title} · Section ${section.position}`}
      actions={
        <>
          <Link
            href={`/admin/courses/${section.course.slug}`}
            className="inline-flex items-center gap-2 rounded-xl border border-[#10283f]/15 bg-white px-4 py-3 text-sm font-bold text-[#10283f]"
          >
            <ArrowLeft size={16} /> Back to program
          </Link>
          <a
            href={`/training/${section.course.slug}?preview=${encodeURIComponent(section.course.updatedAt)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-[#10283f] px-4 py-3 text-sm font-bold text-white"
          >
            Preview <ExternalLink size={16} />
          </a>
        </>
      }
    >
      {(message || error) && (
        <div
          className={`mb-6 rounded-xl border p-4 text-sm font-semibold ${
            error
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {error || message}
        </div>
      )}

      <div className="grid gap-7 xl:grid-cols-[1fr_310px]">
        <div className="space-y-6">
          <section className="space-y-5 rounded-3xl border border-[#10283f]/10 bg-white p-6 sm:p-7">
            <div>
              <p className="text-xs font-black uppercase tracking-[.17em] text-[#9a6812]">
                Section introduction
              </p>
              <h2 className="mt-1 font-serif text-2xl font-semibold text-[#10283f]">
                Opening content
              </h2>
            </div>
            <label className="block">
              <FieldLabel>Navigation title</FieldLabel>
              <input
                value={sectionTitle}
                onChange={(event) => setSectionTitle(event.target.value)}
                className="w-full rounded-xl border border-[#10283f]/15 px-4 py-3"
              />
            </label>
            <label className="block max-w-xs">
              <FieldLabel>Estimated minutes</FieldLabel>
              <input
                type="number"
                min={5}
                value={estimatedMinutes}
                onChange={(event) => setEstimatedMinutes(Number(event.target.value) || 5)}
                className="w-full rounded-xl border border-[#10283f]/15 px-4 py-3"
              />
            </label>
            <label className="block">
              <FieldLabel>Lesson heading</FieldLabel>
              <input
                value={plan.sectionTitle}
                onChange={(event) =>
                  setPlan({ ...plan, sectionTitle: event.target.value })
                }
                className="w-full rounded-xl border border-[#10283f]/15 px-4 py-3"
              />
            </label>
            <label className="block">
              <FieldLabel>Opening</FieldLabel>
              <textarea
                value={plan.opening}
                onChange={(event) => setPlan({ ...plan, opening: event.target.value })}
                rows={5}
                className="w-full resize-y rounded-xl border border-[#10283f]/15 px-4 py-3 leading-7"
              />
            </label>
            <div>
              <FieldLabel>Learning objectives</FieldLabel>
              <StringList
                values={plan.objectives}
                onChange={(objectives) => setPlan({ ...plan, objectives })}
                addLabel="Add objective"
                placeholder="What should the learner be able to do?"
              />
            </div>
          </section>

          <div>
            <div>
              <p className="text-xs font-black uppercase tracking-[.17em] text-[#9a6812]">
                Lesson body
              </p>
              <h2 className="mt-1 font-serif text-3xl font-semibold text-[#10283f]">
                Teaching moments and activities
              </h2>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {[
                { kind: "text" as const, label: "Text page", detail: "Heading and rich teaching text", icon: FileText },
                { kind: "tiles" as const, label: "Three tiles", detail: "Three ideas shown side by side", icon: LayoutGrid },
                { kind: "dragdrop" as const, label: "Drag to order", detail: "Interactive sequencing activity", icon: ListRestart },
                { kind: "visual" as const, label: "Visual explainer", detail: "Pictures synchronized with audio", icon: ImagePlus },
                { kind: "question" as const, label: "Question", detail: "Multiple-choice knowledge check", icon: Check },
                { kind: "scenario" as const, label: "Scenario", detail: "Decision practice with feedback", icon: Plus },
              ].map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.kind}
                    type="button"
                    onClick={() => addMoment(option.kind)}
                    className="flex items-start gap-3 rounded-2xl border border-[#10283f]/10 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#c68b1b] hover:shadow-md"
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#fff3d7] text-[#9a6812]">
                      <Icon size={19} />
                    </span>
                    <span>
                      <span className="block text-sm font-bold text-[#10283f]">{option.label}</span>
                      <span className="mt-1 block text-xs leading-5 text-[#6c7881]">{option.detail}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {plan.moments.map((moment, index) => (
            <MomentEditor
              key={`${index}-${moment.kind}`}
              moment={moment}
              index={index}
              total={plan.moments.length}
              courseSlug={section.course.slug}
              onChange={(updated) => updateMoment(index, updated)}
              onMove={(direction) => moveMoment(index, direction)}
              onDragStart={(event) => {
                setDraggedMomentIndex(index);
                event.dataTransfer.effectAllowed = "move";
              }}
              onDrop={(event) => {
                event.preventDefault();
                moveMomentTo(index);
              }}
              onRemove={() =>
                setPlan({
                  ...plan,
                  moments: plan.moments.filter(
                    (_, itemIndex) => itemIndex !== index,
                  ),
                })
              }
            />
          ))}

          <section className="space-y-5 rounded-3xl border border-[#10283f]/10 bg-white p-6 sm:p-7">
            <div>
              <p className="text-xs font-black uppercase tracking-[.17em] text-[#9a6812]">
                Section close
              </p>
              <h2 className="mt-1 font-serif text-2xl font-semibold text-[#10283f]">
                Summary and key facts
              </h2>
            </div>
            <label className="block">
              <FieldLabel>Summary</FieldLabel>
              <textarea
                value={plan.summary}
                onChange={(event) => setPlan({ ...plan, summary: event.target.value })}
                rows={5}
                className="w-full resize-y rounded-xl border border-[#10283f]/15 px-4 py-3 leading-7"
              />
            </label>
            <div>
              <FieldLabel>Key facts</FieldLabel>
              <StringList
                values={plan.keyFacts}
                onChange={(keyFacts) => setPlan({ ...plan, keyFacts })}
                addLabel="Add key fact"
                placeholder="Important takeaway"
              />
            </div>
          </section>
        </div>

        <aside>
          <div className="sticky top-6 rounded-3xl bg-[#10283f] p-6 text-white shadow-xl">
            <p className="text-xs font-black uppercase tracking-[.17em] text-[#f2c568]">
              Manual editing
            </p>
            <h2 className="mt-2 text-xl font-bold">Save your changes</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              These edits update the source course content and appear in both webpage
              and slideshow formats.
            </p>
            <div className="mt-5 rounded-2xl bg-white/8 p-4 text-sm">
              <p className="font-bold">{plan.moments.length} teaching moments</p>
              <p className="mt-1 text-xs text-slate-400">
                {
                  plan.moments.filter(
                    (moment) =>
                      moment.kind === "question" || moment.kind === "scenario",
                  ).length
                }{" "}
                activities
              </p>
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={save}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#f2b744] px-5 py-4 font-bold text-[#10283f] disabled:opacity-60"
            >
              {saving ? (
                <LoaderCircle className="animate-spin" size={18} />
              ) : (
                <Save size={18} />
              )}
              {saving ? "Saving…" : "Save content"}
            </button>
          </div>
        </aside>
      </div>
    </AdminShell>
  );
}
