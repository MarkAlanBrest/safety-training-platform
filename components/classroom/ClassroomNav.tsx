"use client";

import { Check, GraduationCap } from "lucide-react";
import type { ClassroomPlan } from "@/lib/classroom";

export default function ClassroomNav({
  plan,
  activeSlideIndex,
  taughtSlideIndices,
  onSelectSlide,
}: {
  plan: ClassroomPlan;
  activeSlideIndex: number;
  taughtSlideIndices: number[];
  onSelectSlide: (slideIndex: number) => void;
}) {
  const chapters =
    plan.chapters?.length && plan.chapters.length > 1
      ? plan.chapters
      : [
          {
            id: "chapter-1",
            title: plan.title,
            slideStart: 0,
            slideEnd: Math.max(0, plan.slides.length - 1),
          },
        ];

  return (
    <aside className="flex h-full flex-col border-r border-slate-200 bg-[#f8fafc]">
      <div className="border-b border-slate-200 px-5 py-5">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#0f2b46] text-amber-300">
            <GraduationCap size={22} />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[.16em] text-slate-500">
              Lesson
            </p>
            <p className="truncate font-bold text-slate-900">{plan.title}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {chapters.map((chapter) => {
          const chapterSlides = plan.slides.filter(
            (slide) => slide.index >= chapter.slideStart && slide.index <= chapter.slideEnd,
          );
          return (
            <div key={chapter.id} className="mb-5">
              <p className="px-2 text-xs font-bold uppercase tracking-[.14em] text-slate-500">
                {chapter.title}
              </p>
              <div className="mt-2 space-y-1.5">
                {chapterSlides.map((slide) => {
                  const active = slide.index === activeSlideIndex;
                  const taught = taughtSlideIndices.includes(slide.index);
                  return (
                    <button
                      key={slide.index}
                      type="button"
                      onClick={() => onSelectSlide(slide.index)}
                      className={`flex w-full items-start gap-3 rounded-2xl px-3 py-2.5 text-left transition ${
                        active
                          ? "bg-white shadow-sm ring-1 ring-amber-300"
                          : "hover:bg-white/70"
                      }`}
                    >
                      <span
                        className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${
                          taught
                            ? "bg-emerald-500 text-white"
                            : active
                              ? "bg-amber-400 text-slate-950"
                              : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {taught ? <Check size={13} /> : slide.index + 1}
                      </span>
                      <span className="min-w-0">
                        <p
                          className={`truncate text-sm font-semibold ${
                            active ? "text-slate-900" : "text-slate-700"
                          }`}
                        >
                          {slide.title}
                        </p>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
