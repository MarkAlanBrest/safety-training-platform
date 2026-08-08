"use client";

import { Coffee, GraduationCap } from "lucide-react";

export default function VideoClassroomTopBar({
  title,
  currentTime,
  duration,
  paused = false,
  onToggleBreak,
}: {
  title: string;
  currentTime: number;
  duration: number;
  paused?: boolean;
  onToggleBreak?: () => void;
}) {
  const progressPercent =
    duration > 0 ? Math.round((Math.min(currentTime, duration) / duration) * 100) : 0;

  return (
    <header className="relative z-50 flex shrink-0 items-center gap-3 border-b border-slate-200 bg-[#0f2b46] px-4 py-2.5 text-white sm:gap-4 sm:px-6">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/10 text-amber-300">
        <GraduationCap size={19} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-[.16em] text-amber-200/90">
          Video Classroom
        </p>
        <p className="truncate text-sm font-bold">{title}</p>
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
        <div className="w-36 sm:w-48">
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
      </div>
    </header>
  );
}
