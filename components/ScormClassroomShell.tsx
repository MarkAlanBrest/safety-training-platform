"use client";

import { useCallback, useMemo, useState } from "react";
import { VolumeX } from "lucide-react";
import ScormPlayer, { type ScormRuntimeChange } from "@/components/ScormPlayer";
import ScormClassroomTopBar from "@/components/ScormClassroomTopBar";
import { useInstructorVoice } from "@/lib/instructor-voice";
import { scormLocationFromRuntime, type ScormInstructorConfig } from "@/lib/scorm-instructor";

export type PublicScormCourse = {
  title: string;
  slug: string;
  description: string | null;
  scormVersion: string;
  scormEntryPoint: string;
  instructor: ScormInstructorConfig;
};

function progressFromRuntime(snapshot: Record<string, string>) {
  const measure = Number(
    snapshot["cmi.progress_measure"] || snapshot["cmi.core.score.raw"] || "",
  );
  if (Number.isFinite(measure)) {
    return measure <= 1 ? measure * 100 : Math.min(100, measure);
  }
  const status = (
    snapshot["cmi.completion_status"] ||
    snapshot["cmi.core.lesson_status"] ||
    ""
  ).toLowerCase();
  if (status === "completed" || status === "passed") return 100;
  if (status === "incomplete" || status === "failed") return 35;
  if (status === "browsed") return 15;
  return 0;
}

/**
 * Full-screen SCORM playback: the package itself is the entire experience
 * (top toolbar + player only). Narration comes from whatever text the
 * package marks with `id="ai-narration"` or `data-ai-narration` on the
 * current screen — no separate chat panel or script file required. The
 * first marked screen doubles as the welcome, so there's no separate
 * app-level opening line to race against it.
 */
export default function ScormClassroomShell({
  course,
  preview = false,
}: {
  course: PublicScormCourse;
  preview?: boolean;
}) {
  const voiceSettings = useMemo(() => {
    const teaching = course.instructor.teaching;
    const settings = course.instructor.settings;
    const defaultProvider: "browser" | "premium" =
      teaching.voiceProvider === "browser" ? "browser" : "premium";
    return {
      enabled: settings.speechVoice !== false,
      provider: defaultProvider,
      voice: teaching.voice || "cedar",
      speed: typeof teaching.voiceSpeed === "number" ? teaching.voiceSpeed : 0.96,
    };
  }, [course.instructor]);

  const { speak, cancelSpeech, unlockAudio, needsAudioUnlock } =
    useInstructorVoice(voiceSettings);

  const [progressPercent, setProgressPercent] = useState(0);
  const [locationLabel, setLocationLabel] = useState("");

  const handleRuntimeChange = useCallback((change: ScormRuntimeChange) => {
    setProgressPercent(progressFromRuntime(change.snapshot));
    const location = scormLocationFromRuntime(change.snapshot);
    if (location) setLocationLabel(location);
  }, []);

  const handleNarrationText = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      cancelSpeech();
      void speak(trimmed);
    },
    [cancelSpeech, speak],
  );

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-[#0b1f33] text-white">
      <ScormClassroomTopBar
        title={course.title}
        scormVersion={course.scormVersion}
        preview={preview}
        progressPercent={progressPercent}
        locationLabel={locationLabel}
      />

      <div className="relative min-h-0 flex-1">
        <ScormPlayer
          title={course.title}
          slug={course.slug}
          entryPoint={course.scormEntryPoint}
          version={course.scormVersion}
          preview={preview}
          embedded
          onRuntimeChange={handleRuntimeChange}
          onVisibleTextChange={voiceSettings.enabled ? handleNarrationText : undefined}
          mutePackageAudio={voiceSettings.enabled}
        />

        {needsAudioUnlock ? (
          <button
            type="button"
            onClick={() => unlockAudio()}
            className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-center gap-2 bg-amber-400 px-4 py-3 text-sm font-bold text-[#3a2a05]"
          >
            <VolumeX size={16} />
            Tap to enable the instructor&apos;s voice
          </button>
        ) : null}
      </div>
    </main>
  );
}
