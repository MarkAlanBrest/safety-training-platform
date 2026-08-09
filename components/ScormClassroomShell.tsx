"use client";

import { useCallback, useState } from "react";
import ScormPlayer, { type ScormRuntimeChange } from "@/components/ScormPlayer";
import ScormClassroomTopBar from "@/components/ScormClassroomTopBar";
import {
  scormLocationFromRuntime,
  type ScormInstructorConfig,
} from "@/lib/scorm-instructor";

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
  const [progressPercent, setProgressPercent] = useState(0);
  const [locationLabel, setLocationLabel] = useState("");

  const handleRuntimeChange = useCallback((change: ScormRuntimeChange) => {
    setProgressPercent(progressFromRuntime(change.snapshot));
    const location = scormLocationFromRuntime(change.snapshot);
    if (!location) return;
    setLocationLabel(location);
  }, []);

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
          mutePackageAudio={false}
        />
      </div>
    </main>
  );
}
