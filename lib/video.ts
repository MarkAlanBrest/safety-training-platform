import type { ClassroomQuestion, QuestionType } from "@/lib/classroom-question-types";
import { normalizeAssessmentQuestion } from "@/lib/classroom-question-types";

export type VideoProvider = "youtube";

export type VideoSource = {
  provider: VideoProvider;
  url: string;
  videoId: string;
  durationSeconds?: number;
};

export type VideoCue = {
  id: string;
  atSeconds: number;
  headline: string;
  required: boolean;
  question: ClassroomQuestion;
};

export type VideoPlan = {
  type: "video";
  title: string;
  opening: string;
  objectives: string[];
  source: VideoSource;
  cues: VideoCue[];
  config: {
    requireWatchCompletion: boolean;
    passingScore: number;
  };
};

export type VideoProgressData = {
  currentSeconds: number;
  maxWatchedSeconds: number;
  completedCueIds: string[];
};

export function createVideoCueId() {
  return `cue-${crypto.randomUUID().slice(0, 8)}`;
}

export function parseTimestampInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return NaN;
  if (/^\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  const parts = trimmed.split(":").map((part) => Number(part));
  if (parts.some((part) => Number.isNaN(part))) return NaN;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return NaN;
}

export function formatTimestamp(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

export function parseYouTubeUrl(raw: string): VideoSource | null {
  const value = raw.trim();
  if (!value) return null;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "");
  let videoId = "";

  if (host === "youtu.be") {
    videoId = url.pathname.split("/").filter(Boolean)[0] || "";
  } else if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
    if (url.pathname === "/watch") {
      videoId = url.searchParams.get("v") || "";
    } else if (url.pathname.startsWith("/embed/")) {
      videoId = url.pathname.split("/")[2] || "";
    } else if (url.pathname.startsWith("/shorts/")) {
      videoId = url.pathname.split("/")[2] || "";
    }
  }

  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) return null;

  return {
    provider: "youtube",
    url: `https://www.youtube.com/watch?v=${videoId}`,
    videoId,
  };
}

export function emptyVideoCueQuestion(type: QuestionType = "multipleChoice"): ClassroomQuestion {
  const id = createVideoCueId();
  switch (type) {
    case "trueFalse":
      return {
        id,
        type,
        prompt: "Is this statement correct?",
        correctAnswer: true,
      };
    case "dragDrop":
      return {
        id,
        type,
        prompt: "Put these steps in the correct order.",
        dragItems: ["First step", "Second step", "Third step"],
      };
    case "flashcard":
      return {
        id,
        type,
        prompt: "Review these terms.",
        front: "Term",
        back: "Definition",
      };
    case "shortAnswer":
      return {
        id,
        type,
        prompt: "In your own words, explain the key idea.",
        sampleAnswer: "A complete answer mentions the main concept.",
      };
    case "scenario":
      return {
        id,
        type,
        prompt: "What should you do next?",
        scenarioText: "You notice a coworker skipping a required safety step.",
        responseMode: "multipleChoice",
        choices: ["Stop work and address it", "Ignore it", "Report it later"],
        correctChoice: "Stop work and address it",
      };
    case "multipleChoice":
    default:
      return {
        id,
        type: "multipleChoice",
        prompt: "Which answer is correct?",
        choices: ["Correct answer", "Distractor one", "Distractor two"],
        correctChoice: "Correct answer",
      };
  }
}

export function emptyVideoCue(atSeconds = 30): VideoCue {
  return {
    id: createVideoCueId(),
    atSeconds,
    headline: "Knowledge check",
    required: true,
    question: emptyVideoCueQuestion("multipleChoice"),
  };
}

export function normalizeVideoCue(raw: unknown): VideoCue | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const atSeconds = Number(value.atSeconds);
  if (!Number.isFinite(atSeconds) || atSeconds < 0) return null;
  const question = normalizeAssessmentQuestion(value.question);
  if (!question) return null;
  return {
    id: typeof value.id === "string" && value.id ? value.id : createVideoCueId(),
    atSeconds: Math.round(atSeconds * 10) / 10,
    headline: typeof value.headline === "string" && value.headline.trim()
      ? value.headline.trim()
      : "Knowledge check",
    required: value.required !== false,
    question,
  };
}

export function normalizeVideoPlan(raw: unknown, fallbackTitle = "Video course"): VideoPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const sourceRaw = value.source;
  if (!sourceRaw || typeof sourceRaw !== "object") return null;
  const sourceValue = sourceRaw as Record<string, unknown>;
  const videoId = typeof sourceValue.videoId === "string" ? sourceValue.videoId : "";
  const url = typeof sourceValue.url === "string" ? sourceValue.url : "";
  const parsed = parseYouTubeUrl(url) || (videoId ? parseYouTubeUrl(`https://www.youtube.com/watch?v=${videoId}`) : null);
  if (!parsed) return null;

  const cues = Array.isArray(value.cues)
    ? value.cues
        .map((item) => normalizeVideoCue(item))
        .filter((item): item is VideoCue => Boolean(item))
        .sort((a, b) => a.atSeconds - b.atSeconds)
    : [];

  const configRaw = value.config && typeof value.config === "object"
    ? (value.config as Record<string, unknown>)
    : {};

  return {
    type: "video",
    title: typeof value.title === "string" && value.title.trim() ? value.title.trim() : fallbackTitle,
    opening: typeof value.opening === "string" ? value.opening.trim() : "",
    objectives: Array.isArray(value.objectives)
      ? value.objectives.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
      : [],
    source: {
      ...parsed,
      durationSeconds: typeof sourceValue.durationSeconds === "number"
        ? sourceValue.durationSeconds
        : undefined,
    },
    cues,
    config: {
      requireWatchCompletion: configRaw.requireWatchCompletion !== false,
      passingScore: Math.max(
        0,
        Math.min(100, Number(configRaw.passingScore) || 80),
      ),
    },
  };
}

export function isVideoPlan(raw: unknown): raw is VideoPlan {
  return normalizeVideoPlan(raw) !== null;
}

export function buildDefaultVideoPlan(input: {
  title: string;
  description?: string;
  source: VideoSource;
  cues?: VideoCue[];
}): VideoPlan {
  const description = String(input.description || "").trim();
  return {
    type: "video",
    title: input.title,
    opening: description || `Watch the lesson video, then answer the knowledge checks as they appear.`,
    objectives: [],
    source: input.source,
    cues: input.cues || [],
    config: {
      requireWatchCompletion: true,
      passingScore: 80,
    },
  };
}

export function videoProgressFromEnrollment(raw: unknown): VideoProgressData {
  if (!raw || typeof raw !== "object") {
    return { currentSeconds: 0, maxWatchedSeconds: 0, completedCueIds: [] };
  }
  const value = raw as Record<string, unknown>;
  const video = value.video && typeof value.video === "object"
    ? (value.video as Record<string, unknown>)
    : value;
  const currentSeconds = Number(video.currentSeconds);
  const maxWatchedSeconds = Number(video.maxWatchedSeconds);
  const completedCueIds = Array.isArray(video.completedCueIds)
    ? video.completedCueIds.filter((item): item is string => typeof item === "string")
    : [];
  return {
    currentSeconds: Number.isFinite(currentSeconds) ? Math.max(0, currentSeconds) : 0,
    maxWatchedSeconds: Number.isFinite(maxWatchedSeconds) ? Math.max(0, maxWatchedSeconds) : 0,
    completedCueIds,
  };
}

export function videoProgressPercent(plan: VideoPlan, progress: VideoProgressData) {
  const requiredCues = plan.cues.filter((cue) => cue.required);
  if (!requiredCues.length) {
    const duration = plan.source.durationSeconds || 0;
    if (!duration) return progress.maxWatchedSeconds > 0 ? 35 : 0;
    return Math.min(100, Math.round((progress.maxWatchedSeconds / duration) * 100));
  }
  const completed = requiredCues.filter((cue) => progress.completedCueIds.includes(cue.id)).length;
  return Math.round((completed / requiredCues.length) * 100);
}

export function videoCourseCompleted(plan: VideoPlan, progress: VideoProgressData) {
  const requiredCues = plan.cues.filter((cue) => cue.required);
  if (!requiredCues.length) {
    const duration = plan.source.durationSeconds || 0;
    return duration > 0 ? progress.maxWatchedSeconds >= duration * 0.95 : progress.maxWatchedSeconds > 30;
  }
  return requiredCues.every((cue) => progress.completedCueIds.includes(cue.id));
}
