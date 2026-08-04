"use client";

import {
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  GraduationCap,
  GripVertical,
  Layers,
  MessageCircleQuestion,
  Presentation,
  Sparkles,
} from "lucide-react";
import type { ClassroomPlan } from "@/lib/classroom";
import {
  buildLessonBeats,
  navBeatKind,
  navLabelForBeat,
  navShortLabelForBeat,
  type ClassroomLessonBeat,
} from "@/lib/classroom-lesson";

function NavBeatIcon({
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
  const className = `grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${
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
        <Check size={13} />
      </span>
    );
  }

  if (beat.kind === "slide") {
    return <span className={className}>{beat.slideIndex + 1}</span>;
  }

  const iconClass = "shrink-0";
  const iconSize = 14;

  switch (kind) {
    case "welcome":
      return (
        <span className={className}>
          <Sparkles size={iconSize} className={iconClass} />
        </span>
      );
    case "checkpoint-flashcard":
      return (
        <span className={className}>
          <Layers size={iconSize} className={iconClass} />
        </span>
      );
    case "checkpoint-dragdrop":
      return (
        <span className={className}>
          <GripVertical size={iconSize} className={iconClass} />
        </span>
      );
    case "checkpoint-question":
      return (
        <span className={className}>
          <MessageCircleQuestion size={iconSize} className={iconClass} />
        </span>
      );
    case "assessment":
      return (
        <span className={className}>
          <ClipboardCheck size={iconSize} className={iconClass} />
        </span>
      );
    default:
      return (
        <span className={className}>
          <Presentation size={iconSize} className={iconClass} />
        </span>
      );
  }
}

export default function ClassroomNav({
  plan,
  lessonBeats,
  activeBeatIndex,
  onSelectBeat,
  collapsed = false,
  onToggleCollapse,
}: {
  plan: ClassroomPlan;
  lessonBeats?: ClassroomLessonBeat[];
  activeBeatIndex: number;
  onSelectBeat: (beatIndex: number) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const beats = lessonBeats || plan.lessonBeats || buildLessonBeats(plan);

  return (
    <aside
      className={`flex h-full shrink-0 flex-col border-r border-slate-200 bg-[#f8fafc] transition-[width] duration-200 ${
        collapsed ? "w-[72px]" : "w-[280px]"
      }`}
    >
      <div className={`border-b border-slate-200 ${collapsed ? "px-2 py-4" : "px-5 py-5"}`}>
        <div className={`flex items-center ${collapsed ? "flex-col gap-3" : "gap-3"}`}>
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
        {!collapsed ? (
          <p className="mb-2 px-2 text-xs font-bold uppercase tracking-[.14em] text-slate-500">
            Lesson flow
          </p>
        ) : null}
        <div className="space-y-1.5">
          {beats.map((beat, beatIndex) => {
            const active = beatIndex === activeBeatIndex;
            const completed = beatIndex < activeBeatIndex;
            const label = navLabelForBeat(beat, plan);
            const shortLabel = navShortLabelForBeat(beat, plan);
            const kind = navBeatKind(beat, plan);
            const isActivity = beat.kind === "checkpoint" || beat.kind === "assessment";

            return (
              <button
                key={`${beat.kind}-${beatIndex}`}
                type="button"
                onClick={() => onSelectBeat(beatIndex)}
                title={label}
                aria-label={label}
                className={`flex w-full items-center rounded-2xl transition ${
                  collapsed ? "justify-center p-1.5" : "gap-3 px-3 py-2.5 text-left"
                } ${
                  active
                    ? "bg-white shadow-sm ring-1 ring-amber-300"
                    : isActivity
                      ? "hover:bg-violet-50/80"
                      : "hover:bg-white/70"
                }`}
              >
                <NavBeatIcon beat={beat} plan={plan} completed={completed} active={active} />
                {!collapsed ? (
                  <span className="min-w-0">
                    {isActivity ? (
                      <p className="text-[10px] font-bold uppercase tracking-[.12em] text-violet-600">
                        {kind === "checkpoint-flashcard"
                          ? "Flash cards"
                          : kind === "checkpoint-dragdrop"
                            ? "Drag & drop"
                            : kind === "checkpoint-question"
                              ? "Checkpoint"
                              : kind === "assessment"
                                ? "Assessment"
                                : "Activity"}
                      </p>
                    ) : beat.kind === "welcome" ? (
                      <p className="text-[10px] font-bold uppercase tracking-[.12em] text-slate-500">
                        Start
                      </p>
                    ) : (
                      <p className="text-[10px] font-bold uppercase tracking-[.12em] text-slate-500">
                        Section {beat.kind === "slide" ? beat.slideIndex + 1 : ""}
                      </p>
                    )}
                    <p
                      className={`truncate text-sm font-semibold ${
                        active ? "text-slate-900" : "text-slate-700"
                      }`}
                    >
                      {label}
                    </p>
                  </span>
                ) : (
                  <span className="sr-only">{shortLabel}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
