"use client";

import { useRef, useState, type MouseEvent } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

type ClickMark = { x: number; y: number; correct: boolean };

export default function ClassroomHotspotQuestion({
  headline,
  prompt,
  imageUrl,
  targetX,
  targetY,
  toleranceRadius,
  onComplete,
}: {
  headline: string;
  prompt: string;
  imageUrl: string;
  targetX: number;
  targetY: number;
  toleranceRadius: number;
  onComplete?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mark, setMark] = useState<ClickMark | null>(null);

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    const bounds = containerRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const x = ((event.clientX - bounds.left) / bounds.width) * 100;
    const y = ((event.clientY - bounds.top) / bounds.height) * 100;
    const distance = Math.hypot(x - targetX, y - targetY);
    setMark({ x, y, correct: distance <= toleranceRadius });
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-amber-50 via-white to-slate-50 px-6 py-8">
      <div className="w-full max-w-xl text-center">
        <p className="text-sm font-bold uppercase tracking-[.16em] text-amber-600">{headline}</p>
        <p className="mt-3 text-xl font-semibold leading-8 text-slate-900">{prompt}</p>
      </div>

      <div
        ref={containerRef}
        onClick={handleClick}
        className="relative mt-6 max-h-[55vh] w-full max-w-2xl cursor-crosshair overflow-hidden rounded-2xl border border-slate-200 shadow-sm"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt={prompt} className="block w-full select-none" draggable={false} />
        {mark ? (
          <div
            className={`absolute grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 ${
              mark.correct ? "border-emerald-500 bg-emerald-100/80" : "border-red-500 bg-red-100/80"
            }`}
            style={{ left: `${mark.x}%`, top: `${mark.y}%` }}
          >
            {mark.correct ? (
              <CheckCircle2 className="text-emerald-700" size={18} />
            ) : (
              <XCircle className="text-red-700" size={18} />
            )}
          </div>
        ) : null}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {mark && !mark.correct ? (
          <p className="text-sm font-semibold text-red-700">Not quite — click somewhere else on the image.</p>
        ) : null}
        {mark?.correct ? (
          <button
            type="button"
            onClick={() => onComplete?.()}
            className="inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-5 py-2 text-sm font-semibold text-emerald-800"
          >
            <CheckCircle2 size={16} /> Continue
          </button>
        ) : null}
      </div>
    </div>
  );
}
