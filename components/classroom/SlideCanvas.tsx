"use client";

import type { StructuredClassroomSlide } from "@/lib/classroom-slide-content";
import { slideImageSrc } from "@/lib/classroom";

const THEMES = [
  {
    header: "from-[#0f2b46] to-[#163a5d]",
    accent: "bg-amber-400",
    panel: "from-slate-50 to-white",
    badge: "bg-amber-400 text-slate-950",
  },
  {
    header: "from-[#123524] to-[#1d4d35]",
    accent: "bg-emerald-300",
    panel: "from-emerald-50/80 to-white",
    badge: "bg-emerald-400 text-emerald-950",
  },
  {
    header: "from-[#3b1f4d] to-[#54276d]",
    accent: "bg-fuchsia-300",
    panel: "from-fuchsia-50/70 to-white",
    badge: "bg-fuchsia-300 text-fuchsia-950",
  },
];

export default function SlideCanvas({
  slide,
  courseTitle,
}: {
  slide: StructuredClassroomSlide;
  courseTitle?: string;
}) {
  const theme = THEMES[slide.index % THEMES.length];
  const imageUrl = slideImageSrc(slide);

  if (slide.layout === "image" && imageUrl) {
    return (
      <div className="relative h-full w-full overflow-hidden bg-slate-900">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt={slide.title} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#07111f]/90 via-[#07111f]/35 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-8 lg:p-10">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-amber-300">
            {courseTitle || "Lesson slide"}
          </p>
          <h2 className="mt-3 max-w-3xl text-3xl font-bold leading-tight text-white lg:text-4xl">
            {slide.title}
          </h2>
          {slide.subtitle ? (
            <p className="mt-3 max-w-2xl text-lg text-slate-200">{slide.subtitle}</p>
          ) : null}
        </div>
        <div
          className={`absolute right-6 top-6 rounded-full px-3 py-1 text-xs font-bold ${theme.badge}`}
        >
          {slide.index + 1}
        </div>
      </div>
    );
  }

  if (slide.layout === "split" && imageUrl) {
    return (
      <div className="grid h-full w-full grid-cols-1 bg-white lg:grid-cols-[1.05fr_.95fr]">
        <div className="flex min-h-0 flex-col justify-between p-8 lg:p-10">
          <div>
            <div className={`mb-5 h-1.5 w-16 rounded-full ${theme.accent}`} />
            <p className="text-xs font-bold uppercase tracking-[.18em] text-slate-500">
              Key idea
            </p>
            <h2 className="mt-3 text-3xl font-bold leading-tight text-slate-900 lg:text-4xl">
              {slide.title}
            </h2>
            {slide.subtitle ? (
              <p className="mt-3 text-lg text-slate-600">{slide.subtitle}</p>
            ) : null}
            <ul className="mt-6 space-y-3">
              {slide.bullets.map((bullet) => (
                <li key={bullet} className="flex gap-3 text-base leading-7 text-slate-700">
                  <span className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${theme.accent}`} />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>
          {slide.highlight ? (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-950">
              {slide.highlight}
            </div>
          ) : null}
        </div>
        <div className="relative min-h-[220px] bg-slate-100 lg:min-h-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt={slide.title} className="h-full w-full object-cover" />
        </div>
      </div>
    );
  }

  if (slide.layout === "title") {
    return (
      <div className={`flex h-full w-full flex-col justify-between bg-gradient-to-br ${theme.header} p-8 lg:p-12`}>
        <div>
          <p className="text-xs font-bold uppercase tracking-[.2em] text-amber-200/90">
            {courseTitle || "AI Classroom"}
          </p>
          <div className={`mt-6 h-1.5 w-20 rounded-full ${theme.accent}`} />
        </div>
        <div className="max-w-3xl">
          <h2 className="text-4xl font-bold leading-tight text-white lg:text-5xl">{slide.title}</h2>
          <p className="mt-5 text-xl leading-8 text-slate-200">
            {slide.subtitle || slide.bullets[0] || slide.bodyText}
          </p>
        </div>
        <p className="text-sm font-semibold uppercase tracking-[.16em] text-slate-300">
          Slide {slide.index + 1}
        </p>
      </div>
    );
  }

  return (
    <div className={`grid h-full w-full grid-cols-1 bg-gradient-to-br ${theme.panel} lg:grid-cols-[1.1fr_.9fr]`}>
      <div className="flex min-h-0 flex-col justify-between p-8 lg:p-10">
        <div>
          <div className={`mb-5 h-1.5 w-16 rounded-full ${theme.accent}`} />
          <p className="text-xs font-bold uppercase tracking-[.18em] text-slate-500">
            Teaching point
          </p>
          <h2 className="mt-3 text-3xl font-bold leading-tight text-slate-900 lg:text-4xl">
            {slide.title}
          </h2>
          {slide.subtitle ? (
            <p className="mt-3 text-lg text-slate-600">{slide.subtitle}</p>
          ) : null}
          <ul className="mt-6 space-y-3">
            {slide.bullets.map((bullet) => (
              <li key={bullet} className="flex gap-3 text-base leading-7 text-slate-700">
                <span className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${theme.accent}`} />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </div>
        {slide.highlight ? (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm font-medium text-slate-700 shadow-sm">
            {slide.highlight}
          </div>
        ) : null}
      </div>
      <div className={`relative hidden overflow-hidden bg-gradient-to-br ${theme.header} lg:block`}>
        <div className="absolute inset-0 opacity-20">
          <div className="absolute left-8 top-8 h-28 w-28 rounded-full border border-white/30" />
          <div className="absolute bottom-10 right-10 h-40 w-40 rounded-full border border-white/20" />
          <div className="absolute left-1/3 top-1/3 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        </div>
        <div className="relative flex h-full flex-col justify-end p-10">
          <p className="text-sm font-bold uppercase tracking-[.18em] text-amber-200">On screen</p>
          <p className="mt-3 text-2xl font-semibold leading-8 text-white">
            {slide.highlight || slide.bullets[0] || "Focus on the main takeaway for this slide."}
          </p>
          <p className={`mt-6 inline-flex w-fit rounded-full px-3 py-1 text-xs font-bold ${theme.badge}`}>
            Slide {slide.index + 1}
          </p>
        </div>
      </div>
    </div>
  );
}
