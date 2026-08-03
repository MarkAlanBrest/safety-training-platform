"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import type { LessonMoment } from "@/lib/mason";

export default function FlashcardDeck({ moment }: { moment: LessonMoment }) {
  const cards = (moment.flashcards || []).filter(
    (card) => card.front.trim() || card.back.trim(),
  );
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  if (!cards.length) return null;

  const card = cards[index];

  function goTo(next: number) {
    setIndex(next);
    setFlipped(false);
  }

  return (
    <section className="my-14">
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_20px_60px_rgba(15,23,42,.07)]">
        <div className="h-1 bg-gradient-to-r from-[var(--accent)] via-[var(--accent)]/50 to-transparent" />
        <div className="px-7 py-9 sm:px-10 sm:py-11">
          <p className="text-xs font-black uppercase tracking-[.22em] text-[var(--accent)]">
            Flash cards
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-[var(--ink)] sm:text-4xl">
            {moment.title}
          </h2>
          {moment.narration && (
            <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600">
              {moment.narration}
            </p>
          )}
          <p className="mt-3 text-sm text-slate-500">
            Tap the card to flip · {index + 1} of {cards.length}
          </p>

          <div className="mt-8 flex flex-col items-center gap-6">
            <button
              type="button"
              onClick={() => setFlipped((value) => !value)}
              className="group relative h-64 w-full max-w-xl [perspective:1200px] sm:h-72"
              aria-label={flipped ? "Show term" : "Show definition"}
            >
              <div
                className={`relative h-full w-full rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-[var(--pale)]/50 p-8 shadow-[0_20px_50px_rgba(15,23,42,.08)] transition-transform duration-500 [transform-style:preserve-3d] ${
                  flipped ? "[transform:rotateY(180deg)]" : ""
                }`}
              >
                <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center [backface-visibility:hidden]">
                  <p className="text-xs font-black uppercase tracking-[.2em] text-[var(--accent)]">
                    Term
                  </p>
                  <p className="mt-4 text-2xl font-bold leading-snug text-[var(--ink)] sm:text-3xl">
                    {card.front}
                  </p>
                </div>
                <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center [backface-visibility:hidden] [transform:rotateY(180deg)]">
                  <p className="text-xs font-black uppercase tracking-[.2em] text-[var(--accent)]">
                    Definition
                  </p>
                  <p className="mt-4 text-lg leading-8 text-slate-700 sm:text-xl">
                    {card.back}
                  </p>
                </div>
              </div>
            </button>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => goTo(Math.max(0, index - 1))}
                disabled={index === 0}
                className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-bold text-[var(--ink)] disabled:opacity-30"
              >
                <ChevronLeft size={16} /> Previous
              </button>
              <button
                type="button"
                onClick={() => setFlipped(false)}
                className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-bold text-[var(--ink)]"
              >
                <RotateCcw size={16} /> Reset card
              </button>
              <button
                type="button"
                onClick={() => goTo(Math.min(cards.length - 1, index + 1))}
                disabled={index === cards.length - 1}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--dark)] px-4 py-2 text-sm font-bold text-white disabled:opacity-30"
              >
                Next <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
