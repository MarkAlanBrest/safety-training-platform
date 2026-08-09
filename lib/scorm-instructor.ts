import {
  defaultClassroomBuilderConfig,
  type ClassroomBuilderConfig,
} from "@/lib/classroom-builder";
import { isClassroomPlan } from "@/lib/classroom";

export type ScormNarrationCue = {
  /** SCORM location value or page id from cmi.core.lesson_location / cmi.location */
  location: string;
  text: string;
};

export type ScormInstructorConfig = {
  teaching: ClassroomBuilderConfig["teaching"];
  settings: ClassroomBuilderConfig["settings"];
  narration: ScormNarrationCue[];
  opening?: string;
};

export function scormInstructorConfigFromLessonPlan(lessonPlan: unknown): ScormInstructorConfig {
  const defaults = defaultClassroomBuilderConfig();
  if (!isClassroomPlan(lessonPlan)) {
    return {
      teaching: defaults.teaching,
      settings: defaults.settings,
      narration: [],
      opening: undefined,
    };
  }

  const config = lessonPlan.config || defaults;
  const rawNarration = (lessonPlan as { scormNarration?: unknown }).scormNarration;
  const narration = Array.isArray(rawNarration)
    ? rawNarration
        .filter((item): item is ScormNarrationCue => {
          if (!item || typeof item !== "object") return false;
          const cue = item as ScormNarrationCue;
          return typeof cue.location === "string" && typeof cue.text === "string";
        })
        .map((cue) => ({ location: cue.location.trim(), text: cue.text.trim() }))
        .filter((cue) => cue.location && cue.text)
    : [];

  const teaching = {
    ...defaults.teaching,
    ...(config.teaching || {}),
    voiceProvider:
      config.teaching?.voiceProvider === "browser" ? ("browser" as const) : ("premium" as const),
    voice: config.teaching?.voice || defaults.teaching.voice || "cedar",
  };

  return {
    teaching,
    settings: { ...defaults.settings, ...(config.settings || {}) },
    narration,
    opening: lessonPlan.opening,
  };
}

export function scormLocationFromRuntime(data: Record<string, string>) {
  return (
    data["cmi.core.lesson_location"]?.trim() ||
    data["cmi.location"]?.trim() ||
    data["cmi.suspend_data"]?.trim() ||
    ""
  );
}

export function narrationForLocation(
  narration: ScormNarrationCue[],
  location: string,
): ScormNarrationCue | null {
  if (!location) return null;
  const exact = narration.find((cue) => cue.location === location);
  if (exact) return exact;
  const normalizedLocation = location.toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (!normalizedLocation) return null;
  return narration.find((cue) => {
    const normalizedCue = cue.location.toLowerCase().replace(/[^a-z0-9]+/g, "");
    return normalizedCue === normalizedLocation ||
      normalizedLocation.includes(normalizedCue) ||
      normalizedCue.includes(normalizedLocation);
  }) || null;
}

export function buildDefaultScormLessonPlan(input: {
  title: string;
  description?: string;
  config?: ClassroomBuilderConfig;
}) {
  const config = input.config || defaultClassroomBuilderConfig();
  return {
    type: "classroom" as const,
    title: input.title,
    opening: input.description || `Welcome to ${input.title}.`,
    objectives: [] as string[],
    topics: [] as string[],
    slides: [] as never[],
    scormNarration: [] as ScormNarrationCue[],
    config,
  };
}
