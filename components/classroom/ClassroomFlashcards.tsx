"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";

export default function ClassroomFlashcards({
  headline,
  prompt,
  flashcards,
  onComplete,
}: {
  headline: string;
  prompt?: string;
  flashcards: Array<{ front: string; back: string }>;
  onComplete?: () => void;
}) {
  const cards = flashcards.filter((card) => card.front.trim() || card.back.trim());
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  if (!cards.length) return null;

  const card = cards[index];
  const isLast = index === cards.length - 1;

  function goTo(next: number) {
    setIndex(next);
    setFlipped(false);
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-slate-50 px-8 py-10">
      <div className="max-w-2xl text-center">
        <p className="text-sm font-bold uppercase tracking-[.16em] text-indigo-600">
          Flash cards
        </p>
        <h2 className="mt-3 text-2xl font-semibold text-slate-900">{headline}</h2>
        {prompt ? <p className="mt-3 text-base text-slate-600">{prompt}</p> : null}
        <p className="mt-2 text-sm text-slate-500">
          Tap the card to flip · {index + 1} of {cards.length}
        </p>
      </div>

      <button
        type="button"
        onClick={() => setFlipped((value) => !value)}
        className="group relative mt-8 h-56 w-full max-w-xl [perspective:1200px] sm:h-64"
        aria-label={flipped ? "Show term" : "Show definition"}
      >
        <div
          className={`relative h-full w-full rounded-3xl border border-slate-200 bg-white p-8 shadow-lg transition-transform duration-500 [transform-style:preserve-3d] ${
            flipped ? "[transform:rotateY(180deg)]" : ""
          }`}
        >
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center [backface-visibility:hidden]">
            <p className="text-xs font-bold uppercase tracking-[.16em] text-indigo-500">Term</p>
            <p className="mt-4 text-2xl font-bold text-slate-900">{card.front}</p>
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <p className="text-xs font-bold uppercase tracking-[.16em] text-indigo-500">
              Definition
            </p>
            <p className="mt-4 text-lg leading-8 text-slate-700">{card.back}</p>
          </div>
        </div>
      </button>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => goTo(Math.max(0, index - 1))}
          disabled={index === 0}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-30"
        >
          <ChevronLeft size={16} /> Previous
        </button>
        <button
          type="button"
          onClick={() => setFlipped(false)}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
        >
          <RotateCcw size={16} /> Reset card
        </button>
        {isLast ? (
          <button
            type="button"
            onClick={() => onComplete?.()}
            className="inline-flex items-center gap-2 rounded-full bg-[#0f2b46] px-5 py-2 text-sm font-semibold text-white"
          >
            Continue
          </button>
        ) : (
          <button
            type="button"
            onClick={() => goTo(index + 1)}
            className="inline-flex items-center gap-2 rounded-full bg-[#0f2b46] px-4 py-2 text-sm font-semibold text-white"
          >
            Next <ChevronRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
