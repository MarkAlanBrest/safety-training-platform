"use client";

import { Award } from "lucide-react";
import { formatTimestamp } from "@/lib/video";

export default function VideoCourseTopBar({
  title,
  preview = false,
  progressPercent,
  currentSeconds,
  durationSeconds,
  activeCueLabel,
  certificateUrl,
}: {
  title: string;
  preview?: boolean;
  progressPercent: number;
  currentSeconds: number;
  durationSeconds: number;
  activeCueLabel?: string;
  certificateUrl?: string;
}) {
  return (
    <header className="border-b border-white/10 bg-[#10283f] px-4 py-3 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-serif text-lg font-semibold text-white">{title}</p>
          <p className="text-xs text-slate-300">
            Video course{preview ? " · Administrator preview" : ""}
            {durationSeconds > 0
              ? ` · ${formatTimestamp(currentSeconds)} / ${formatTimestamp(durationSeconds)}`
              : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {activeCueLabel ? (
            <span className="rounded-full bg-amber-300/15 px-3 py-1 text-xs font-bold text-amber-200">
              {activeCueLabel}
            </span>
          ) : null}
          <span className="text-sm font-bold text-amber-200">{Math.round(progressPercent)}%</span>
          {!preview && certificateUrl ? (
            <a
              href={certificateUrl}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-bold text-white"
            >
              <Award size={14} /> Certificate
            </a>
          ) : null}
        </div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-amber-300 transition-[width] duration-500"
          style={{ width: `${Math.max(0, Math.min(100, progressPercent))}%` }}
        />
      </div>
    </header>
  );
}
