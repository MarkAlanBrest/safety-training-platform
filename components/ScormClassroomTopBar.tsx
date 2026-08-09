"use client";

import { GraduationCap, Maximize2 } from "lucide-react";

export default function ScormClassroomTopBar({
  title,
  scormVersion,
  preview = false,
  voiceLabel,
  progressPercent = 0,
  locationLabel,
  onFullscreen,
}: {
  title: string;
  scormVersion: string;
  preview?: boolean;
  voiceLabel?: string;
  progressPercent?: number;
  locationLabel?: string;
  onFullscreen?: () => void;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(progressPercent)));

  return (
    <header className="relative z-50 flex h-12 shrink-0 items-center gap-2.5 border-b border-white/10 bg-[#0f2b46] px-3 text-white sm:h-14 sm:gap-4 sm:px-5">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/10 text-amber-300 sm:h-9 sm:w-9 sm:rounded-xl">
        <GraduationCap size={18} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-[.16em] text-amber-200/90">
          SCORM {scormVersion}
          {preview ? " · Preview" : ""}
        </p>
        <p className="truncate text-sm font-bold leading-tight">{title}</p>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        {locationLabel ? (
          <span className="hidden max-w-[9rem] truncate rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold text-amber-100 lg:inline">
            {locationLabel}
          </span>
        ) : null}
        {voiceLabel ? (
          <span className="hidden rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold text-amber-100 md:inline">
            {voiceLabel}
          </span>
        ) : null}
        <div className="hidden w-28 sm:block sm:w-36">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[.12em] text-amber-200/90">
            <span>Progress</span>
            <span>{clamped}%</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-300 transition-[width] duration-500"
              style={{ width: `${clamped}%` }}
            />
          </div>
        </div>
        {onFullscreen ? (
          <button
            type="button"
            onClick={onFullscreen}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-2.5 py-1.5 text-xs font-bold text-white transition hover:bg-white/20"
            aria-label="Fullscreen SCORM lesson"
          >
            <Maximize2 size={14} />
            <span className="hidden sm:inline">Full screen</span>
          </button>
        ) : null}
      </div>
    </header>
  );
}
