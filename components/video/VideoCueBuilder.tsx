"use client";

import { Plus, Trash2 } from "lucide-react";
import {
  QUESTION_TYPE_LABELS,
  QUESTION_TYPES,
  type ClassroomQuestion,
  type QuestionType,
} from "@/lib/classroom-question-types";
import { QuestionEditorFields } from "@/components/classroom/builder/QuestionDraftReview";
import {
  emptyVideoCue,
  formatTimestamp,
  parseTimestampInput,
  type VideoCue,
} from "@/lib/video";

export default function VideoCueBuilder({
  cues,
  onChange,
}: {
  cues: VideoCue[];
  onChange: (next: VideoCue[]) => void;
}) {
  function updateCue(index: number, patch: Partial<VideoCue>) {
    onChange(
      cues.map((cue, cueIndex) => (cueIndex === index ? { ...cue, ...patch } : cue)),
    );
  }

  function updateQuestion(index: number, question: ClassroomQuestion) {
    updateCue(index, { question });
  }

  function removeCue(index: number) {
    onChange(cues.filter((_, cueIndex) => cueIndex !== index));
  }

  function addCue() {
    const lastSeconds = cues.length ? cues[cues.length - 1].atSeconds + 60 : 30;
    onChange([...cues, emptyVideoCue(lastSeconds)].sort((a, b) => a.atSeconds - b.atSeconds));
  }

  return (
    <div className="space-y-4">
      {cues.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#10283f]/15 bg-[#f8faf9] px-5 py-8 text-center text-sm text-[#69757e]">
          No stopping points yet. Add a knowledge check to pause the video at a specific timestamp.
        </div>
      ) : null}

      {cues.map((cue, index) => (
        <article
          key={cue.id}
          className="rounded-3xl border border-[#10283f]/10 bg-white p-5 shadow-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[.14em] text-[#a06e16]">
                Stopping point {index + 1}
              </p>
              <p className="mt-1 text-sm font-semibold text-[#69757e]">
                Pauses at {formatTimestamp(cue.atSeconds)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => removeCue(index)}
              className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-xs font-bold text-red-700"
            >
              <Trash2 size={14} /> Remove
            </button>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label>
              <span className="mb-2 block text-sm font-bold text-[#263746]">Timestamp (mm:ss)</span>
              <input
                defaultValue={formatTimestamp(cue.atSeconds)}
                onBlur={(event) => {
                  const seconds = parseTimestampInput(event.target.value);
                  if (!Number.isFinite(seconds)) return;
                  updateCue(index, { atSeconds: seconds });
                  onChange(
                    cues
                      .map((item, cueIndex) =>
                        cueIndex === index ? { ...item, atSeconds: seconds } : item,
                      )
                      .sort((a, b) => a.atSeconds - b.atSeconds),
                  );
                }}
                className="w-full rounded-xl border border-[#10283f]/15 px-4 py-3"
                placeholder="1:30"
              />
            </label>
            <label>
              <span className="mb-2 block text-sm font-bold text-[#263746]">Headline</span>
              <input
                value={cue.headline}
                onChange={(event) => updateCue(index, { headline: event.target.value })}
                className="w-full rounded-xl border border-[#10283f]/15 px-4 py-3"
              />
            </label>
            <label className="sm:col-span-2">
              <span className="mb-2 block text-sm font-bold text-[#263746]">Interaction type</span>
              <select
                value={cue.question.type}
                onChange={(event) => {
                  const type = event.target.value as QuestionType;
                  const nextQuestion: ClassroomQuestion = {
                    ...cue.question,
                    type,
                    ...(type === "multipleChoice"
                      ? {
                          choices: ["Correct answer", "Distractor one", "Distractor two"],
                          correctChoice: "Correct answer",
                        }
                      : {}),
                    ...(type === "trueFalse" ? { correctAnswer: true } : {}),
                    ...(type === "shortAnswer"
                      ? { sampleAnswer: "A complete answer mentions the main concept." }
                      : {}),
                    ...(type === "dragDrop"
                      ? { dragItems: ["First step", "Second step", "Third step"] }
                      : {}),
                    ...(type === "flashcard" ? { front: "Term", back: "Definition" } : {}),
                  } as ClassroomQuestion;
                  updateQuestion(index, nextQuestion);
                }}
                className="w-full rounded-xl border border-[#10283f]/15 bg-white px-4 py-3"
              >
                {QUESTION_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {QUESTION_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-5 rounded-2xl border border-[#10283f]/10 bg-[#f8faf9] p-4">
            <QuestionEditorFields
              question={cue.question}
              onChange={(question) => updateQuestion(index, question)}
            />
          </div>
        </article>
      ))}

      <button
        type="button"
        onClick={addCue}
        className="inline-flex items-center gap-2 rounded-xl border border-[#10283f]/15 bg-white px-4 py-3 text-sm font-bold text-[#10283f]"
      >
        <Plus size={16} /> Add stopping point
      </button>
    </div>
  );
}
