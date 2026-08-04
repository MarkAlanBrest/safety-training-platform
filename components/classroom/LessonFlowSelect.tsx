"use client";

import { useRef } from "react";
import { Check, ChevronDown, List } from "lucide-react";
import type { ClassroomPlan } from "@/lib/classroom";
import {
  buildLessonBeats,
  navLabelForBeat,
  type ClassroomLessonBeat,
} from "@/lib/classroom-lesson";

function optionLabel(beat: ClassroomLessonBeat, plan: ClassroomPlan) {
  const label = navLabelForBeat(beat, plan);
  if (beat.kind === "welcome") return `Start — ${label}`;
  if (beat.kind === "slide") return `Slide ${beat.slideIndex + 1} — ${label}`;
  if (beat.kind === "assessment") return `Assessment — ${label}`;
  return `Activity — ${label}`;
}

export default function LessonFlowSelect({
  plan,
  lessonBeats,
  activeBeatIndex,
  onSelectBeat,
}: {
  plan: ClassroomPlan;
  lessonBeats?: ClassroomLessonBeat[];
  activeBeatIndex: number;
  onSelectBeat: (beatIndex: number) => void;
}) {
  const beats = lessonBeats || plan.lessonBeats || buildLessonBeats(plan);
  const detailsRef = useRef<HTMLDetailsElement | null>(null);
  const activeBeat = beats[activeBeatIndex] || beats[0];

  return (
    <details ref={detailsRef} className="group relative min-w-0">
      <summary className="flex min-w-0 cursor-pointer list-none items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 py-2 pl-3 pr-3 text-sm font-semibold text-slate-700 transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-amber-300 [&::-webkit-details-marker]:hidden">
        <List size={16} className="shrink-0 text-slate-500" />
        <span className="max-w-[min(42vw,420px)] truncate">
          {activeBeat ? optionLabel(activeBeat, plan) : "Lesson navigation"}
        </span>
        <ChevronDown size={16} className="shrink-0 text-slate-500 transition group-open:rotate-180" />
      </summary>

      <div className="absolute right-0 z-50 mt-2 max-h-[60vh] w-[min(88vw,440px)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl">
        {beats.map((beat, index) => {
          const active = index === activeBeatIndex;
          return (
            <button
              key={`${beat.kind}-${index}`}
              type="button"
              onClick={() => {
                detailsRef.current?.removeAttribute("open");
                onSelectBeat(index);
              }}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                active ? "bg-amber-50 font-bold text-slate-900" : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span className="grid h-5 w-5 shrink-0 place-items-center">
                {active || index < activeBeatIndex ? <Check size={15} className="text-emerald-600" /> : null}
              </span>
              <span className="truncate">{optionLabel(beat, plan)}</span>
            </button>
          );
        })}
      </div>
    </details>
  );
}
