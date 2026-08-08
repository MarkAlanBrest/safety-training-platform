import type { ClassroomPlan } from "@/lib/classroom";
import {
  defaultClassroomBuilderConfig,
  type ClassroomBuilderConfig,
} from "@/lib/classroom-builder";

/** What happens when playback reaches a timeline marker. */
export type VideoMarkerKind = "continue" | "ai_say" | "ask_question" | "quick_check";

export type VideoTimelineMarker = {
  id: string;
  atSeconds: number;
  label?: string;
  kind: VideoMarkerKind;
  /** Spoken/shown by the AI when kind is ai_say or ask_question lead-in. */
  aiScript?: string;
  questionPrompt?: string;
  questionType?: "multipleChoice" | "trueFalse" | "shortAnswer";
  options?: string[];
  /** Grading key — option text, "true"/"false", or short-answer reference. */
  correctAnswer?: string;
};

export type VideoChapter = {
  id: string;
  title: string;
  startSeconds: number;
};

export type VideoCourseConfig = {
  videoAssetPath: string;
  captionsAssetPath?: string;
  durationSeconds?: number;
  chapters: VideoChapter[];
  /** Draft stop points — edited in the activities builder. */
  markers: VideoTimelineMarker[];
  /** Snapshot shown to learners after activities are published. */
  publishedMarkers?: VideoTimelineMarker[];
  /** When true, learners see `publishedMarkers` during playback. */
  activitiesPublished?: boolean;
  /** Resolved at serve time */
  videoUrl?: string;
  captionsUrl?: string;
};

export function createVideoId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

export function parseTimestampInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d+(\.\d+)?$/.test(trimmed)) return Math.max(0, Number(trimmed));
  const parts = trimmed.split(":").map((part) => part.trim());
  if (parts.length === 2) {
    const minutes = Number(parts[0]);
    const seconds = Number(parts[1]);
    if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
    return Math.max(0, minutes * 60 + seconds);
  }
  if (parts.length === 3) {
    const hours = Number(parts[0]);
    const minutes = Number(parts[1]);
    const seconds = Number(parts[2]);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes) || !Number.isFinite(seconds)) {
      return null;
    }
    return Math.max(0, hours * 3600 + minutes * 60 + seconds);
  }
  return null;
}

export function formatTimestamp(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

export function sortVideoMarkers(markers: VideoTimelineMarker[]) {
  return [...markers].sort((a, b) => a.atSeconds - b.atSeconds);
}

/** Markers used during playback — draft for admin preview, published for learners. */
export function resolveVideoCourseMarkers(
  videoCourse: VideoCourseConfig,
  options?: { previewDraft?: boolean },
): VideoTimelineMarker[] {
  if (options?.previewDraft) {
    return sortVideoMarkers(videoCourse.markers || []);
  }
  if (!videoCourse.activitiesPublished) {
    return [];
  }
  const published = videoCourse.publishedMarkers?.length
    ? videoCourse.publishedMarkers
    : videoCourse.markers;
  return sortVideoMarkers(published || []);
}

export function sortVideoChapters(chapters: VideoChapter[]) {
  return [...chapters].sort((a, b) => a.startSeconds - b.startSeconds);
}

export function chapterAtTime(chapters: VideoChapter[], seconds: number): VideoChapter | null {
  const sorted = sortVideoChapters(chapters);
  let active: VideoChapter | null = null;
  for (const chapter of sorted) {
    if (seconds >= chapter.startSeconds) active = chapter;
    else break;
  }
  return active;
}

export function classroomVideoAssetUrl(slug: string, assetPath: string) {
  const normalized = assetPath.replace(/^classroom\//, "");
  return `/api/classroom/${encodeURIComponent(slug)}/asset/classroom/${normalized
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

export function hydrateVideoCourse(
  videoCourse: VideoCourseConfig,
  slug: string,
): VideoCourseConfig {
  return {
    ...videoCourse,
    videoUrl: classroomVideoAssetUrl(slug, videoCourse.videoAssetPath),
    captionsUrl: videoCourse.captionsAssetPath
      ? classroomVideoAssetUrl(slug, videoCourse.captionsAssetPath)
      : undefined,
    chapters: sortVideoChapters(videoCourse.chapters),
    markers: sortVideoMarkers(videoCourse.markers || []),
    publishedMarkers: videoCourse.publishedMarkers
      ? sortVideoMarkers(videoCourse.publishedMarkers)
      : undefined,
    activitiesPublished: Boolean(videoCourse.activitiesPublished),
  };
}

export function buildVideoClassroomPlan(input: {
  title: string;
  description?: string;
  videoCourse: VideoCourseConfig;
  config?: ClassroomBuilderConfig;
}): ClassroomPlan {
  const config = input.config || defaultClassroomBuilderConfig();
  return {
    type: "classroom",
    title: input.title,
    opening: input.description || "Welcome to your course.",
    objectives: [],
    topics: [],
    slides: [],
    videoCourse: {
      ...input.videoCourse,
      chapters: sortVideoChapters(input.videoCourse.chapters),
      markers: sortVideoMarkers(input.videoCourse.markers),
      publishedMarkers: input.videoCourse.publishedMarkers
        ? sortVideoMarkers(input.videoCourse.publishedMarkers)
        : undefined,
      activitiesPublished: Boolean(input.videoCourse.activitiesPublished),
    },
    config,
  };
}

export function isVideoClassroomPlan(plan: ClassroomPlan): boolean {
  return Boolean(plan.videoCourse?.videoAssetPath);
}

export function markerToCheckQuestion(marker: VideoTimelineMarker) {
  if (marker.kind !== "quick_check" && marker.kind !== "ask_question") return null;
  if (!marker.questionPrompt?.trim()) return null;
  const type = marker.questionType || "shortAnswer";
  return {
    prompt: marker.questionPrompt.trim(),
    type,
    options:
      type === "multipleChoice" || type === "trueFalse"
        ? (marker.options || []).filter(Boolean)
        : undefined,
  };
}
