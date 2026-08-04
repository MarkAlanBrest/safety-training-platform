"use client";

import { type DragEvent, useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, GripVertical } from "lucide-react";

function initialOrder(items: string[]) {
  return items.length > 1 ? [...items].reverse() : [...items];
}

export default function ClassroomDragOrder({
  headline,
  prompt,
  dragItems,
  onComplete,
}: {
  headline: string;
  prompt: string;
  dragItems: string[];
  onComplete?: () => void;
}) {
  const correctItems = dragItems.filter(Boolean);
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
    <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-slate-50 px-6 py-10">
      <div className="w-full max-w-xl text-center">
        <p className="text-sm font-bold uppercase tracking-[.16em] text-emerald-600">
          Drag and drop
        </p>
        <h2 className="mt-3 text-2xl font-semibold text-slate-900">{headline}</h2>
        <p className="mt-4 text-base text-slate-600">{prompt}</p>
      </div>

      <div className="mt-8 w-full max-w-xl space-y-3">
        {items.map((item, index) => (
          <div
            key={`${item}-${index}`}
            draggable
            onDragStart={() => setDragIndex(index)}
            onDragEnd={() => setDragIndex(null)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => drop(event, index)}
            className={`flex items-center gap-3 rounded-xl border bg-white px-3 py-3 font-medium sm:px-4 sm:py-4 ${
              dragIndex === index
                ? "border-emerald-400 opacity-45"
                : "border-slate-200 hover:border-slate-400"
            }`}
          >
            <GripVertical className="hidden shrink-0 cursor-grab text-slate-400 sm:block" size={18} />
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-emerald-50 text-xs font-bold text-emerald-700">
              {index + 1}
            </span>
            <span className="flex-1 text-left text-slate-800">{item}</span>
            <div className="flex shrink-0 flex-col gap-1">
              <button
                type="button"
                aria-label={`Move ${item} up`}
                disabled={index === 0}
                onClick={() => moveItem(index, index - 1)}
                className="grid h-7 w-7 place-items-center rounded-md border border-slate-200 text-slate-500 disabled:opacity-30"
              >
                <ChevronUp size={16} />
              </button>
              <button
                type="button"
                aria-label={`Move ${item} down`}
                disabled={index === items.length - 1}
                onClick={() => moveItem(index, index + 1)}
                className="grid h-7 w-7 place-items-center rounded-md border border-slate-200 text-slate-500 disabled:opacity-30"
              >
                <ChevronDown size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => setSubmitted(true)}
          className="rounded-full bg-[#0f2b46] px-5 py-2 text-sm font-semibold text-white"
        >
          Check my order
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

      {submitted ? (
        <p
          className={`mt-4 text-sm font-semibold ${correct ? "text-emerald-700" : "text-amber-700"}`}
        >
          {correct
            ? "Nice work — that's the right order."
            : "Not quite — keep adjusting until the sequence matches."}
        </p>
      ) : null}
    </div>
  );
}
