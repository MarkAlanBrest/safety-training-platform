"use client";

import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

export default function ClassroomTrueFalse({
  headline,
  prompt,
  correctAnswer,
  onComplete,
}: {
  headline: string;
  prompt: string;
  correctAnswer: boolean;
  onComplete?: () => void;
}) {
  const [selected, setSelected] = useState<boolean | null>(null);

  const correct = selected !== null && selected === correctAnswer;
  const answered = selected !== null;

  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-amber-50 via-white to-slate-50 px-6 py-10">
      <div className="w-full max-w-xl text-center">
        <p className="text-sm font-bold uppercase tracking-[.16em] text-amber-600">{headline}</p>
        <p className="mt-4 text-2xl font-semibold leading-9 text-slate-900">{prompt}</p>
      </div>

      <div className="mt-8 flex w-full max-w-md gap-4">
        {[true, false].map((value) => {
          const isSelected = selected === value;
          const showCorrectness = answered && isSelected;
          return (
            <button
              key={String(value)}
              type="button"
              onClick={() => setSelected(value)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-6 py-5 text-lg font-bold transition ${
                showCorrectness
                  ? correct
                    ? "border-emerald-400 bg-emerald-50 text-emerald-800"
                    : "border-red-300 bg-red-50 text-red-700"
                  : isSelected
                    ? "border-[#c68b1b] bg-[#fff9eb] text-slate-900"
                    : "border-slate-200 bg-white text-slate-800 hover:border-slate-400"
              }`}
            >
              {value ? "True" : "False"}
              {showCorrectness ? (correct ? <CheckCircle2 size={18} /> : <XCircle size={18} />) : null}
            </button>
          );
        })}
      </div>

      <div className="mt-8">
        {answered && correct ? (
          <button
            type="button"
            onClick={() => onComplete?.()}
            className="inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-5 py-2 text-sm font-semibold text-emerald-800"
          >
            <CheckCircle2 size={16} /> Continue
          </button>
        ) : answered ? (
          <p className="text-sm font-semibold text-red-700">Not quite — try the other answer.</p>
        ) : null}
      </div>
    </div>
  );
}
