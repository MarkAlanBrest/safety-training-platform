"use client";

import { Check, GraduationCap } from "lucide-react";
import type { ClassroomPlan, ClassroomTopic } from "@/lib/classroom";

export default function ClassroomNav({
  plan,
  activeTopicId,
  completedTopicIds,
  currentSlideIndex,
  onSelectTopic,
  onSelectSlide,
}: {
  plan: ClassroomPlan;
  activeTopicId: string | null;
  completedTopicIds: string[];
  currentSlideIndex: number;
  onSelectTopic: (topic: ClassroomTopic) => void;
  onSelectSlide: (slideIndex: number) => void;
}) {
  return (
    <aside className="flex h-full flex-col border-r border-slate-200 bg-[#f8fafc]">
      <div className="border-b border-slate-200 px-5 py-5">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#0f2b46] text-amber-300">
            <GraduationCap size={22} />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[.16em] text-slate-500">
              Lesson
            </p>
            <p className="font-bold text-slate-900">{plan.title}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <p className="px-2 text-xs font-bold uppercase tracking-[.14em] text-slate-500">
          Topics
        </p>
        <div className="mt-3 space-y-2">
          {plan.topics.map((topic) => {
            const active = topic.id === activeTopicId;
            const complete = completedTopicIds.includes(topic.id);
            return (
              <button
                key={topic.id}
                onClick={() => onSelectTopic(topic)}
                className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${
                  active
                    ? "bg-white shadow-sm ring-1 ring-slate-200"
                    : "hover:bg-white/70"
                }`}
              >
                <span
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold ${
                    complete
                      ? "bg-emerald-500 text-white"
                      : active
                        ? "bg-amber-400 text-slate-950"
                        : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {complete ? <Check size={14} /> : topic.slideStart + 1}
                </span>
                <span className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {topic.title}
                  </p>
                  <p className="text-xs text-slate-500">
                    Slide {topic.slideStart + 1}
                    {topic.slideEnd !== topic.slideStart
                      ? `–${topic.slideEnd + 1}`
                      : ""}
                  </p>
                </span>
              </button>
            );
          })}
        </div>

        <p className="mt-6 px-2 text-xs font-bold uppercase tracking-[.14em] text-slate-500">
          Slides
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {plan.slides.map((slide) => (
            <button
              key={slide.index}
              onClick={() => onSelectSlide(slide.index)}
              className={`overflow-hidden rounded-xl border text-left transition ${
                currentSlideIndex === slide.index
                  ? "border-amber-400 ring-2 ring-amber-200"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={slide.imageDataUrl}
                alt={slide.title}
                className="aspect-video w-full object-cover"
              />
              <p className="truncate px-2 py-2 text-xs font-semibold text-slate-700">
                {slide.index + 1}. {slide.title}
              </p>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
