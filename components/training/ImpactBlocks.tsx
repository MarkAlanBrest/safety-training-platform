"use client";

import { type DragEvent, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  GripVertical,
  RotateCcw,
} from "lucide-react";
import type { LessonMoment } from "@/lib/mason";

function tileGridClass(count: number) {
  if (count === 4) return "grid gap-4 sm:grid-cols-2";
  if (count <= 3) return "grid gap-4 md:grid-cols-3";
  if (count === 5 || count === 6) return "grid gap-4 sm:grid-cols-2 lg:grid-cols-3";
  return "grid gap-4 sm:grid-cols-2 lg:grid-cols-3";
}

export function ImpactTiles({ moment }: { moment: LessonMoment }) {
  const tiles = (moment.tiles || []).filter((tile) => tile.title || tile.body);
  if (!tiles.length) return null;

  return (
    <section className="my-14">
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_20px_60px_rgba(15,23,42,.07)]">
        <div className="h-1 bg-gradient-to-r from-[var(--accent)] via-[var(--accent)]/50 to-transparent" />
        <div className="px-7 py-9 sm:px-10 sm:py-11">
          <p className="text-xs font-black uppercase tracking-[.22em] text-[var(--accent)]">
            Key ideas
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-[var(--ink)] sm:text-4xl">
            {moment.title}
          </h2>
          {moment.narration && (
            <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600">
              {moment.narration}
            </p>
          )}
          <div className={`mt-8 ${tileGridClass(tiles.length)}`}>
            {tiles.map((tile, index) => (
              <article
                key={`${tile.title}-${index}`}
                className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-[var(--pale)]/40 p-6 shadow-[0_10px_30px_rgba(15,23,42,.05)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(15,23,42,.1)]"
              >
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--accent)] to-transparent opacity-80" />
                <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--dark)] text-sm font-black text-white">
                  {index + 1}
                </span>
                <h3 className="mt-5 text-xl font-bold text-[var(--ink)]">
                  {tile.title}
                </h3>
                <p className="mt-3 leading-7 text-slate-600">{tile.body}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function initialOrder(items: string[]) {
  return items.length > 1 ? [...items].reverse() : [...items];
}

export function DragOrderActivity({ moment }: { moment: LessonMoment }) {
  const correctItems = (moment.dragItems || []).filter(Boolean);
  const [items, setItems] = useState(() => initialOrder(correctItems));
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  if (correctItems.length < 2) return null;

  const correct = items.every((item, index) => item === correctItems[index]);

  function moveItem(from: number, to: number) {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setItems(next);
    setSubmitted(false);
  }

  function drop(event: DragEvent<HTMLDivElement>, destination: number) {
    event.preventDefault();
    if (dragIndex === null || dragIndex === destination) return;
    moveItem(dragIndex, destination);
    setDragIndex(null);
  }

  return (
    <section className="my-14 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_20px_60px_rgba(15,23,42,.08)]">
      <div className="h-1 bg-gradient-to-r from-[var(--accent)] to-[var(--dark)]" />
      <div className="border-b border-slate-100 px-6 py-5 sm:px-9">
        <p className="mb-2 text-xs font-black uppercase tracking-[.22em] text-[var(--accent)]">
          Interactive activity
        </p>
        <h2 className="text-2xl font-bold leading-tight text-[var(--ink)] sm:text-3xl">
          {moment.title}
        </h2>
      </div>
      <div className="px-6 py-7 sm:px-9">
        {moment.narration && (
          <p className="mb-4 text-lg leading-8 text-slate-600">{moment.narration}</p>
        )}
        <p className="mb-5 text-lg font-semibold text-[var(--ink)]">
          {moment.prompt || "Drag the items into the correct order."}
        </p>
        <div className="space-y-3">
          {items.map((item, index) => (
            <div
              key={`${item}-${index}`}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragEnd={() => setDragIndex(null)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => drop(event, index)}
              className={`flex items-center gap-3 rounded-xl border bg-white px-3 py-3 font-semibold sm:px-4 sm:py-4 ${
                dragIndex === index
                  ? "border-[var(--accent)] opacity-45"
                  : "border-slate-200 hover:border-slate-400"
              }`}
            >
              <GripVertical className="hidden shrink-0 cursor-grab text-slate-400 sm:block" size={19} />
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--pale)] text-xs font-black text-[var(--accent)]">
                {index + 1}
              </span>
              <span className="flex-1 leading-6 text-[var(--ink)]">{item}</span>
              <div className="flex shrink-0 flex-col gap-1">
                <button
                  type="button"
                  aria-label={`Move ${item} up`}
                  disabled={index === 0}
                  onClick={() => moveItem(index, index - 1)}
                  className="grid h-7 w-7 place-items-center rounded-md border border-slate-200 text-slate-500 transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-30"
                >
                  <ChevronUp size={16} />
                </button>
                <button
                  type="button"
                  aria-label={`Move ${item} down`}
                  disabled={index === items.length - 1}
                  onClick={() => moveItem(index, index + 1)}
                  className="grid h-7 w-7 place-items-center rounded-md border border-slate-200 text-slate-500 transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-30"
                >
                  <ChevronDown size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setSubmitted(true)}
            className="rounded-full bg-[var(--dark)] px-6 py-3 text-sm font-bold text-white transition hover:opacity-90"
          >
            Check order
          </button>
          <button
            type="button"
            onClick={() => {
              setItems(initialOrder(correctItems));
              setSubmitted(false);
            }}
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700 transition hover:border-slate-500"
          >
            <RotateCcw size={15} /> Reset
          </button>
        </div>
        {submitted && (
          <div
            className={`mt-6 rounded-xl border-l-4 p-5 ${
              correct
                ? "border-emerald-600 bg-emerald-50 text-emerald-950"
                : "border-amber-500 bg-amber-50 text-amber-950"
            }`}
          >
            <p className="flex items-center gap-2 font-bold">
              {correct && <CheckCircle2 size={18} />}
              {correct ? "Correct order" : "Not quite yet"}
            </p>
            <p className="mt-1 leading-7">
              {moment.feedback ||
                (correct
                  ? "You placed every step in the correct sequence."
                  : "Review the sequence and move the steps again.")}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
