"use client";

import { HelpCircle } from "lucide-react";
import type { ClassroomCheckQuestion } from "@/lib/classroom";

const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F"];

const TYPE_LABEL: Record<ClassroomCheckQuestion["type"], string> = {
  multipleChoice: "Multiple choice",
  trueFalse: "True or false",
  shortAnswer: "Short answer",
};

export default function QuickCheckCard({
  question,
  onSelectOption,
  disabled = false,
  showPrompt = true,
}: {
  question: ClassroomCheckQuestion;
  /** When provided, multiple-choice/true-false options render as clickable buttons that submit directly. */
  onSelectOption?: (option: string) => void;
  disabled?: boolean;
  showPrompt?: boolean;
}) {
  const options = question.options?.length
    ? question.options
    : question.type === "trueFalse"
      ? ["True", "False"]
      : undefined;
  const interactive = Boolean(onSelectOption);

  return (
    <div className="overflow-hidden rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 via-white to-amber-50/70 shadow-lg shadow-amber-900/10">
      <div className="flex items-center gap-2 border-b border-amber-200/70 bg-amber-100/60 px-4 py-2.5">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-amber-500 text-white">
          <HelpCircle size={14} />
        </span>
        <span className="text-xs font-bold uppercase tracking-[.16em] text-amber-800">Quick Check</span>
        <span className="ml-auto text-[10px] font-bold uppercase tracking-[.1em] text-amber-600/80">
          {TYPE_LABEL[question.type]}
        </span>
      </div>

      <div className="px-4 py-4">
        {showPrompt ? (
          <p className="text-base font-semibold leading-7 text-slate-900">{question.prompt}</p>
        ) : null}

        {options?.length ? (
          <div className={showPrompt ? "mt-3 space-y-2" : "space-y-2"}>
            {options.map((option, index) =>
              interactive ? (
                <button
                  key={option}
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelectOption?.(option)}
                  className="flex w-full items-center gap-3 rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-left transition hover:border-amber-400 hover:bg-amber-100/60 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-amber-100 text-xs font-bold text-amber-800">
                    {OPTION_LETTERS[index] || index + 1}
                  </span>
                  <span className="text-sm font-medium text-slate-800">{option}</span>
                </button>
              ) : (
                <div
                  key={option}
                  className="flex items-center gap-3 rounded-xl border border-amber-200 bg-white px-3 py-2.5"
                >
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-amber-100 text-xs font-bold text-amber-800">
                    {OPTION_LETTERS[index] || index + 1}
                  </span>
                  <span className="text-sm font-medium text-slate-800">{option}</span>
                </div>
              ),
            )}
          </div>
        ) : showPrompt ? (
          <p className="mt-3 text-sm font-medium text-amber-700">
            Type or speak your answer below.
          </p>
        ) : null}
      </div>
    </div>
  );
}
