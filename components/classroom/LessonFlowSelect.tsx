"use client";

import { ChevronDown, List } from "lucide-react";
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

  return (
    <label className="relative flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-3 pr-9 text-sm font-semibold text-slate-700 transition focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-200">
      <List size={16} className="shrink-0 text-slate-500" />
      <span className="sr-only">Lesson navigation</span>
      <select
        value={activeBeatIndex}
        onChange={(event) => onSelectBeat(Number(event.target.value))}
        className="min-w-0 max-w-[min(42vw,420px)] appearance-none truncate bg-transparent pr-2 outline-none"
        aria-label="Current lesson item"
      >
        {beats.map((beat, index) => (
          <option key={`${beat.kind}-${index}`} value={index}>
            {index < activeBeatIndex ? `✓ ${optionLabel(beat, plan)}` : optionLabel(beat, plan)}
          </option>
        ))}
      </select>
      <ChevronDown
        size={16}
        className="pointer-events-none absolute right-3 text-slate-500"
      />
    </label>
  );
}
