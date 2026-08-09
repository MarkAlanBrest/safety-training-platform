"use client";

import { GraduationCap } from "lucide-react";

export type ScormVoiceProvider = "premium" | "browser";

export default function ScormClassroomTopBar({
  title,
  scormVersion,
  preview = false,
  voiceProvider,
  premiumVoiceLabel = "Premium",
  onVoiceProviderChange,
  progressPercent = 0,
  locationLabel,
}: {
  title: string;
  scormVersion: string;
  preview?: boolean;
  voiceProvider?: ScormVoiceProvider;
  premiumVoiceLabel?: string;
  onVoiceProviderChange?: (provider: ScormVoiceProvider) => void;
  progressPercent?: number;
  locationLabel?: string;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(progressPercent)));

  return (
    <header className="relative z-50 flex shrink-0 items-center gap-3 border-b border-white/10 bg-[#0f2b46] px-4 py-2.5 text-white sm:gap-4 sm:px-6">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/10 text-amber-300">
        <GraduationCap size={19} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-[.16em] text-amber-200/90">
          SCORM {scormVersion}
          {preview ? " · Preview" : ""}
        </p>
        <p className="truncate text-sm font-bold">{title}</p>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {locationLabel ? (
          <span className="hidden max-w-[10rem] truncate rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold text-amber-100 md:inline">
            {locationLabel}
          </span>
        ) : null}
        {voiceProvider ? (
          <div className="hidden items-center gap-0.5 rounded-full bg-white/10 p-0.5 text-xs font-bold sm:flex">
            <button
              type="button"
              onClick={() => onVoiceProviderChange?.("premium")}
              className={`rounded-full px-2.5 py-1 transition ${
                voiceProvider === "premium" ? "bg-amber-400 text-[#10283f]" : "text-amber-100"
              }`}
            >
              {premiumVoiceLabel}
            </button>
            <button
              type="button"
              onClick={() => onVoiceProviderChange?.("browser")}
              className={`rounded-full px-2.5 py-1 transition ${
                voiceProvider === "browser" ? "bg-amber-400 text-[#10283f]" : "text-amber-100"
              }`}
            >
              Free
            </button>
          </div>
        ) : null}
        <div className="w-28 sm:w-40">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[.12em] text-amber-200/90">
            <span>Progress</span>
            <span>{clamped}%</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-300 transition-[width] duration-500"
              style={{ width: `${clamped}%` }}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
