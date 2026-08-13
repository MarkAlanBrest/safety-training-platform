"use client";

import { useMemo, useState } from "react";
import type { ClassroomQuestion } from "@/lib/classroom-question-types";
import { gradeVideoCueAnswer } from "@/lib/video-grading";
import type { VideoCue } from "@/lib/video";
import QuickCheckCard from "@/components/classroom/QuickCheckCard";
import ClassroomDragOrder from "@/components/classroom/ClassroomDragOrder";
import ClassroomFlashcards from "@/components/classroom/ClassroomFlashcards";
import ClassroomHotspotQuestion from "@/components/classroom/ClassroomHotspotQuestion";

function questionToQuickCheck(question: ClassroomQuestion) {
  if (question.type === "multipleChoice") {
    return {
      prompt: question.prompt,
      type: "multipleChoice" as const,
      options: question.choices,
    };
  }
  if (question.type === "trueFalse") {
    return {
      prompt: question.prompt,
      type: "trueFalse" as const,
    };
  }
  if (question.type === "scenario" && question.responseMode === "multipleChoice") {
    return {
      prompt: `${question.scenarioText}\n\n${question.prompt}`,
      type: "multipleChoice" as const,
      options: question.choices,
    };
  }
  if (question.type === "shortAnswer" || (question.type === "scenario" && question.responseMode === "shortAnswer")) {
    return {
      prompt: question.type === "scenario"
        ? `${question.scenarioText}\n\n${question.prompt}`
        : question.prompt,
      type: "shortAnswer" as const,
    };
  }
  return null;
}

export default function VideoCuePanel({
  cue,
  onComplete,
}: {
  cue: VideoCue;
  onComplete: (correct: boolean) => void;
}) {
  const [shortAnswer, setShortAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [correct, setCorrect] = useState<boolean | null>(null);

  const quickCheck = useMemo(() => questionToQuickCheck(cue.question), [cue.question]);

  function submitAnswer(answer: string) {
    const result = gradeVideoCueAnswer(cue.question, answer);
    setSubmitted(true);
    setCorrect(result.correct);
    setFeedback(
      result.correct
        ? result.feedback || "Correct. Continue watching."
        : result.feedback || "Not quite. Review the video section and try again.",
    );
    if (result.correct) {
      window.setTimeout(() => onComplete(true), 900);
    }
  }

  return (
    <div className="absolute inset-0 z-20 flex items-end justify-center bg-slate-950/55 p-4 sm:items-center sm:p-8">
      <div className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-white/10 bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-5 py-4">
          <p className="text-xs font-black uppercase tracking-[.16em] text-[#a06e16]">
            {cue.headline}
          </p>
        </div>

        <div className="p-5">
          {quickCheck ? (
            quickCheck.type === "shortAnswer" ? (
              <div>
                <p className="text-base font-semibold leading-7 text-slate-900">{quickCheck.prompt}</p>
                <textarea
                  value={shortAnswer}
                  onChange={(event) => setShortAnswer(event.target.value)}
                  rows={4}
                  disabled={submitted && correct === true}
                  className="mt-4 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#c68b1b]"
                  placeholder="Type your answer"
                />
                {!submitted || correct === false ? (
                  <button
                    type="button"
                    onClick={() => submitAnswer(shortAnswer)}
                    disabled={!shortAnswer.trim()}
                    className="mt-4 rounded-xl bg-[#10283f] px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
                  >
                    Submit answer
                  </button>
                ) : null}
              </div>
            ) : (
              <QuickCheckCard
                question={quickCheck}
                disabled={submitted && correct === true}
                onSelectOption={(option) => submitAnswer(option)}
              />
            )
          ) : cue.question.type === "dragDrop" ? (
            <ClassroomDragOrder
              headline={cue.headline}
              prompt={cue.question.prompt}
              dragItems={cue.question.dragItems}
              onComplete={() => onComplete(true)}
            />
          ) : cue.question.type === "flashcard" ? (
            <ClassroomFlashcards
              headline={cue.headline}
              prompt={cue.question.prompt}
              flashcards={[{ front: cue.question.front, back: cue.question.back }]}
              onComplete={() => onComplete(true)}
            />
          ) : cue.question.type === "hotspot" ? (
            <ClassroomHotspotQuestion
              headline={cue.headline}
              prompt={cue.question.prompt}
              imageUrl={cue.question.imageUrl}
              targetX={cue.question.targetX}
              targetY={cue.question.targetY}
              toleranceRadius={cue.question.toleranceRadius}
              onComplete={() => onComplete(true)}
            />
          ) : null}

          {feedback ? (
            <div
              className={`mt-4 rounded-2xl px-4 py-3 text-sm font-semibold ${
                correct ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"
              }`}
            >
              {feedback}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
