"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import type { LessonMoment } from "@/lib/mason";

export default function HotspotActivity({ moment }: { moment: LessonMoment }) {
  const points = useMemo(
    () => (moment.hotspotPoints || []).filter((point) => point.label || point.text),
    [moment.hotspotPoints],
  );
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [found, setFound] = useState<number[]>([]);

  if (!moment.sourceImage || !points.length) return null;

  const complete = found.length === points.length;

  function selectPoint(index: number) {
    setActiveIndex(index);
    setFound((current) => (current.includes(index) ? current : [...current, index]));
  }

  return (
    <section className="my-14">
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_20px_60px_rgba(15,23,42,.07)]">
        <div className="h-1 bg-gradient-to-r from-[var(--accent)] via-[var(--accent)]/50 to-transparent" />
        <div className="px-7 py-9 sm:px-10 sm:py-11">
          <p className="text-xs font-black uppercase tracking-[.22em] text-[var(--accent)]">
            Click to explore
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-[var(--ink)] sm:text-4xl">
            {moment.title}
          </h2>
          {moment.narration && (
            <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600">
              {moment.narration}
            </p>
          )}
          {moment.prompt && (
            <p className="mt-5 text-lg font-semibold leading-8 text-[var(--ink)]">
              {moment.prompt}
            </p>
          )}

          <div className="relative mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
            <Image
              src={moment.sourceImage}
              alt={moment.sourceImageAlt || moment.title}
              width={1200}
              height={720}
              className="h-auto w-full"
            />
            {points.map((point, index) => {
              const discovered = found.includes(index);
              return (
                <button
                  key={`${point.label}-${index}`}
                  type="button"
                  onClick={() => selectPoint(index)}
                  className={`absolute flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 text-xs font-black transition hover:scale-110 ${
                    discovered
                      ? "border-emerald-600 bg-emerald-500 text-white"
                      : "border-[var(--dark)] bg-[var(--accent)] text-[var(--dark)] shadow-lg"
                  }`}
                  style={{ left: `${point.x}%`, top: `${point.y}%` }}
                  aria-label={point.label}
                >
                  {discovered ? <CheckCircle2 size={16} /> : index + 1}
                </button>
              );
            })}
          </div>

          {activeIndex !== null && (
            <div className="mt-6 rounded-2xl border border-[var(--accent)]/25 bg-[var(--pale)]/60 px-6 py-5">
              <p className="text-sm font-black uppercase tracking-[.18em] text-[var(--accent)]">
                {points[activeIndex].label}
              </p>
              <p className="mt-3 text-lg leading-8 text-slate-700">
                {points[activeIndex].text}
              </p>
            </div>
          )}

          {complete && (
            <p className="mt-5 text-sm font-semibold text-emerald-700">
              You explored all {points.length} points on this image.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
