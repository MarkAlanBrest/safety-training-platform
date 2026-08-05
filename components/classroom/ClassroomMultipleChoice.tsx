"use client";

import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

export default function ClassroomMultipleChoice({
  headline,
  prompt,
  choices,
  correctChoice,
  onComplete,
}: {
  headline: string;
  prompt: string;
  choices: string[];
  correctChoice: string;
  onComplete?: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const correct = selected === correctChoice;

  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-amber-50 via-white to-slate-50 px-6 py-10">
      <div className="w-full max-w-xl text-center">
        <p className="text-sm font-bold uppercase tracking-[.16em] text-amber-600">{headline}</p>
        <p className="mt-4 text-2xl font-semibold leading-9 text-slate-900">{prompt}</p>
      </div>

      <div className="mt-8 w-full max-w-xl space-y-3">
        {choices.map((choice) => {
          const isSelected = selected === choice;
          const showCorrectness = submitted && isSelected;
          return (
            <button
              key={choice}
              type="button"
              onClick={() => {
                setSelected(choice);
                setSubmitted(false);
              }}
              className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left font-medium transition ${
                showCorrectness
                  ? correct
                    ? "border-emerald-400 bg-emerald-50 text-emerald-800"
                    : "border-red-300 bg-red-50 text-red-700"
                  : isSelected
                    ? "border-[#c68b1b] bg-[#fff9eb] text-slate-900"
                    : "border-slate-200 bg-white text-slate-800 hover:border-slate-400"
              }`}
            >
              <span>{choice}</span>
              {showCorrectness ? (
                correct ? <CheckCircle2 size={18} /> : <XCircle size={18} />
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          disabled={!selected}
          onClick={() => setSubmitted(true)}
          className="rounded-full bg-[#0f2b46] px-5 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          Check answer
        </button>
        {submitted && correct ? (
          <button
            type="button"
            onClick={() => onComplete?.()}
            className="inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-5 py-2 text-sm font-semibold text-emerald-800"
          >
            <CheckCircle2 size={16} /> Continue
          </button>
        ) : null}
      </div>

      {submitted && !correct ? (
        <p className="mt-4 text-sm font-semibold text-red-700">Not quite — try another answer.</p>
      ) : null}
    </div>
  );
}
