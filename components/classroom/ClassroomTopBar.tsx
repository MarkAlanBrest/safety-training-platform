"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ClipboardCheck,
  Coffee,
  GraduationCap,
  GripVertical,
  Layers,
  MessageCircleQuestion,
  Play,
  Presentation,
  Sparkles,
} from "lucide-react";
import type { ClassroomPlan } from "@/lib/classroom";
import {
  navBeatKind,
  navLabelForBeat,
  type ClassroomLessonBeat,
} from "@/lib/classroom-lesson";

function BeatIcon({
  beat,
  plan,
  completed,
  active,
}: {
  beat: ClassroomLessonBeat;
  plan: ClassroomPlan;
  completed: boolean;
  active: boolean;
}) {
  const kind = navBeatKind(beat, plan);
  const className = `grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
    completed
      ? "bg-emerald-500 text-white"
      : active
        ? "bg-amber-400 text-slate-950"
        : kind === "assessment"
          ? "bg-indigo-100 text-indigo-700"
          : kind.startsWith("checkpoint")
            ? "bg-violet-100 text-violet-700"
            : "bg-slate-200 text-slate-600"
  }`;

  if (completed) {
    return (
      <span className={className}>
        <Check size={12} />
      </span>
    );
  }

  if (beat.kind === "slide") {
    return <span className={className}>{beat.slideIndex + 1}</span>;
  }

  const iconSize = 12;
  switch (kind) {
    case "welcome":
      return (
        <span className={className}>
          <Sparkles size={iconSize} />
        </span>
      );
    case "checkpoint-flashcard":
      return (
        <span className={className}>
          <Layers size={iconSize} />
        </span>
      );
    case "checkpoint-dragdrop":
      return (
        <span className={className}>
          <GripVertical size={iconSize} />
        </span>
      );
    case "checkpoint-question":
      return (
        <span className={className}>
          <MessageCircleQuestion size={iconSize} />
        </span>
      );
    case "checkpoint-video":
      return (
        <span className={className}>
          <Play size={iconSize} />
        </span>
      );
    case "assessment":
      return (
        <span className={className}>
          <ClipboardCheck size={iconSize} />
        </span>
      );
    default:
      return (
        <span className={className}>
          <Presentation size={iconSize} />
        </span>
      );
  }
}

export default function ClassroomTopBar({
  plan,
  lessonBeats,
  activeBeatIndex,
  onSelectBeat,
  paused = false,
  onToggleBreak,
}: {
  plan: ClassroomPlan;
  lessonBeats: ClassroomLessonBeat[];
  activeBeatIndex: number;
  onSelectBeat: (beatIndex: number) => void;
  paused?: boolean;
  onToggleBreak?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const totalBeats = lessonBeats.length;
  const completedBeats = Math.min(activeBeatIndex, Math.max(totalBeats - 1, 0));
  const progressPercent = totalBeats > 1 ? Math.round((completedBeats / (totalBeats - 1)) * 100) : 0;
  const activeBeat = lessonBeats[activeBeatIndex];
  const activeLabel = activeBeat ? navLabelForBeat(activeBeat, plan) : plan.title;

  useEffect(() => {
    if (!open) return;
    function onClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  return (
    <header className="relative z-50 flex shrink-0 items-center gap-3 border-b border-slate-200 bg-[#0f2b46] px-4 py-2.5 text-white sm:gap-4 sm:px-6">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/10 text-amber-300">
        <GraduationCap size={19} />
      </span>

      <div className="min-w-0 hidden sm:block">
        <p className="text-[10px] font-bold uppercase tracking-[.16em] text-amber-200/90">
          AI Classroom
        </p>
        <p className="truncate text-sm font-bold">{plan.title}</p>
      </div>

      <div ref={menuRef} className="relative min-w-0 flex-1 sm:max-w-md">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="flex w-full items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-left text-sm font-semibold transition hover:bg-white/15"
          aria-expanded={open}
          aria-haspopup="listbox"
        >
          {activeBeat ? (
            <BeatIcon beat={activeBeat} plan={plan} completed={false} active />
          ) : null}
          <span className="min-w-0 flex-1 truncate">{activeLabel}</span>
          <ChevronDown
            size={16}
            className={`shrink-0 text-amber-200 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>

        {open ? (
          <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[60vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 text-slate-900 shadow-2xl">
            <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-[.14em] text-slate-500">
              Lesson flow
            </p>
            {lessonBeats.map((beat, beatIndex) => {
              const active = beatIndex === activeBeatIndex;
              const completed = beatIndex < activeBeatIndex;
              const label = navLabelForBeat(beat, plan);
              const kind = navBeatKind(beat, plan);
              const isActivity = beat.kind === "checkpoint" || beat.kind === "assessment";

              return (
                <button
                  key={`${beat.kind}-${beatIndex}`}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onSelectBeat(beatIndex);
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition ${
                    active
                      ? "bg-amber-50 ring-1 ring-amber-300"
                      : isActivity
                        ? "hover:bg-violet-50"
                        : "hover:bg-slate-50"
                  }`}
                >
                  <BeatIcon beat={beat} plan={plan} completed={completed} active={active} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[10px] font-bold uppercase tracking-[.12em] text-slate-400">
                      {kind === "assessment"
                        ? "Final assessment"
                        : kind.startsWith("checkpoint")
                          ? "Activity"
                          : beat.kind === "welcome"
                            ? "Start"
                            : `Slide ${beat.kind === "slide" ? beat.slideIndex + 1 : ""}`}
                    </span>
                    <span
                      className={`block truncate text-sm font-semibold ${
                        active ? "text-slate-900" : "text-slate-700"
                      }`}
                    >
                      {label}
                    </span>
                  </span>
                  {completed ? (
                    <Check size={14} className="shrink-0 text-emerald-500" />
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {onToggleBreak ? (
          <button
            type="button"
            onClick={onToggleBreak}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
              paused
                ? "border-emerald-300/60 bg-emerald-400/20 text-emerald-100"
                : "border-white/15 bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            <Coffee size={14} />
            <span className="hidden sm:inline">{paused ? "Resume class" : "Take a break"}</span>
          </button>
        ) : null}
        <div className="hidden w-36 sm:block md:w-48">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[.12em] text-amber-200/90">
            <span>Progress</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-300 transition-[width] duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
        <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold text-amber-100">
          {Math.min(activeBeatIndex + 1, totalBeats)} / {totalBeats}
        </span>
      </div>
    </header>
  );
}
