"use client";

import { type DragEvent, useState } from "react";
import { CheckCircle2, GripVertical, RotateCcw } from "lucide-react";
import type { LessonMoment } from "@/lib/mason";

export function ImpactTiles({ moment }: { moment: LessonMoment }) {
  const tiles = (moment.tiles || []).filter((tile) => tile.title || tile.body);
  if (!tiles.length) return null;

  return (
    <section className="my-14">
      <p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--accent)]">
        Key ideas
      </p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--ink)] sm:text-4xl">
        {moment.title}
      </h2>
      {moment.narration && (
        <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-700">
          {moment.narration}
        </p>
      )}
      <div className="mt-7 grid gap-4 md:grid-cols-3">
        {tiles.map((tile, index) => (
          <article
            key={`${tile.title}-${index}`}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,.07)]"
          >
            <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--pale)] text-sm font-black text-[var(--accent)]">
              {index + 1}
            </span>
            <h3 className="mt-5 text-xl font-bold text-[var(--ink)]">{tile.title}</h3>
            <p className="mt-3 leading-7 text-slate-600">{tile.body}</p>
          </article>
        ))}
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

  function drop(event: DragEvent<HTMLDivElement>, destination: number) {
    event.preventDefault();
    if (dragIndex === null || dragIndex === destination) return;
    const next = [...items];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(destination, 0, moved);
    setItems(next);
    setDragIndex(null);
    setSubmitted(false);
  }

  return (
    <section className="my-14 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_50px_rgba(30,41,59,.08)]">
      <div className="border-b border-slate-100 px-6 py-5 sm:px-9">
        <p className="mb-2 text-xs font-bold uppercase tracking-[.2em] text-[var(--accent)]">
          Drag and drop
        </p>
        <h2 className="text-2xl font-semibold leading-tight text-[var(--ink)]">
          {moment.title}
        </h2>
      </div>
      <div className="px-6 py-7 sm:px-9">
        {moment.narration && (
          <p className="mb-4 leading-7 text-slate-600">{moment.narration}</p>
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
              className={`flex cursor-grab items-center gap-3 rounded-xl border bg-white px-4 py-4 font-semibold active:cursor-grabbing ${
                dragIndex === index
                  ? "border-[var(--accent)] opacity-45"
                  : "border-slate-200 hover:border-slate-400"
              }`}
            >
              <GripVertical className="shrink-0 text-slate-400" size={19} />
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--pale)] text-xs font-black text-[var(--accent)]">
                {index + 1}
              </span>
              {item}
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setSubmitted(true)}
            className="rounded-full bg-[var(--dark)] px-6 py-3 text-sm font-bold text-white"
          >
            Check order
          </button>
          <button
            type="button"
            onClick={() => {
              setItems(initialOrder(correctItems));
              setSubmitted(false);
            }}
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700"
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
