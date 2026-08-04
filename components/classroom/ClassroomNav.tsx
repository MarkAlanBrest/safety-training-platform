"use client";

import { Check, ChevronLeft, ChevronRight, GraduationCap } from "lucide-react";
import type { ClassroomPlan } from "@/lib/classroom";

export default function ClassroomNav({
  plan,
  activeSlideIndex,
  taughtSlideIndices,
  onSelectSlide,
  collapsed = false,
  onToggleCollapse,
}: {
  plan: ClassroomPlan;
  activeSlideIndex: number;
  taughtSlideIndices: number[];
  onSelectSlide: (slideIndex: number) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
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
    <aside
      className={`flex h-full shrink-0 flex-col border-r border-slate-200 bg-[#f8fafc] transition-[width] duration-200 ${
        collapsed ? "w-[72px]" : "w-[280px]"
      }`}
    >
      <div className={`border-b border-slate-200 ${collapsed ? "px-2 py-4" : "px-5 py-5"}`}>
        <div
          className={`flex items-center ${collapsed ? "flex-col gap-3" : "gap-3"}`}
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#0f2b46] text-amber-300">
            <GraduationCap size={22} />
          </span>
          {!collapsed ? (
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-[.16em] text-slate-500">
                Lesson
              </p>
              <p className="truncate font-bold text-slate-900">{plan.title}</p>
            </div>
          ) : null}
          {onToggleCollapse ? (
            <button
              type="button"
              onClick={onToggleCollapse}
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-500 transition hover:bg-white hover:text-slate-800 ${
                collapsed ? "" : "ml-auto"
              }`}
              aria-label={collapsed ? "Expand lesson menu" : "Collapse lesson menu"}
              title={collapsed ? "Expand menu" : "Collapse menu"}
            >
              {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
          ) : null}
        </div>
      </div>

      <div className={`flex-1 overflow-y-auto ${collapsed ? "px-2 py-3" : "px-4 py-4"}`}>
        {chapters.map((chapter) => {
          const chapterSlides = plan.slides.filter(
            (slide) => slide.index >= chapter.slideStart && slide.index <= chapter.slideEnd,
          );
          return (
            <div key={chapter.id} className={collapsed ? "mb-3" : "mb-5"}>
              {!collapsed ? (
                <p className="px-2 text-xs font-bold uppercase tracking-[.14em] text-slate-500">
                  {chapter.title}
                </p>
              ) : null}
              <div className={collapsed ? "space-y-1.5" : "mt-2 space-y-1.5"}>
                {chapterSlides.map((slide) => {
                  const active = slide.index === activeSlideIndex;
                  const taught = taughtSlideIndices.includes(slide.index);
                  return (
                    <button
                      key={slide.index}
                      type="button"
                      onClick={() => onSelectSlide(slide.index)}
                      title={slide.title}
                      aria-label={`Slide ${slide.index + 1}: ${slide.title}`}
                      className={`flex w-full items-center rounded-2xl transition ${
                        collapsed
                          ? "justify-center p-1.5"
                          : "items-start gap-3 px-3 py-2.5 text-left"
                      } ${
                        active
                          ? "bg-white shadow-sm ring-1 ring-amber-300"
                          : "hover:bg-white/70"
                      }`}
                    >
                      <span
                        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${
                          taught
                            ? "bg-emerald-500 text-white"
                            : active
                              ? "bg-amber-400 text-slate-950"
                              : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {taught ? <Check size={13} /> : slide.index + 1}
                      </span>
                      {!collapsed ? (
                        <span className="min-w-0">
                          <p
                            className={`truncate text-sm font-semibold ${
                              active ? "text-slate-900" : "text-slate-700"
                            }`}
                          >
                            {slide.title}
                          </p>
                        </span>
                      ) : null}
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
