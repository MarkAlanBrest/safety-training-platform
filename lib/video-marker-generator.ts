import { extractResponseOutputText } from "@/lib/parse-response";
import {
  createVideoId,
  formatTimestamp,
  sortVideoMarkers,
  type VideoMarkerKind,
  type VideoTimelineMarker,
} from "@/lib/classroom-video";
import { parseWebVtt, type VideoCaptionCue } from "@/lib/video-captions";

export const DEFAULT_MARKER_INTERVAL_SECONDS = 60;
const MAX_MARKERS = 30;

export type TranscriptMinuteSegment = {
  atSeconds: number;
  windowStart: number;
  windowEnd: number;
  text: string;
};

export type VideoMarkerGenerationRequest = {
  courseTitle: string;
  courseDescription?: string;
  vtt: string;
  durationSeconds?: number;
  intervalSeconds?: number;
};

export type VideoMarkerGenerationResult = {
  markers: VideoTimelineMarker[];
  warnings: string[];
};

export function minuteMarkerAnchors(
  durationSeconds: number,
  intervalSeconds = DEFAULT_MARKER_INTERVAL_SECONDS,
): number[] {
  if (!Number.isFinite(durationSeconds) || durationSeconds < intervalSeconds + 15) {
    return [];
  }

  const anchors: number[] = [];
  for (let at = intervalSeconds; at < durationSeconds - 15; at += intervalSeconds) {
    anchors.push(at);
    if (anchors.length >= MAX_MARKERS) break;
  }
  return anchors;
}

export function transcriptTextForWindow(
  cues: VideoCaptionCue[],
  windowStart: number,
  windowEnd: number,
): string {
  return cues
    .filter((cue) => cue.endSeconds > windowStart && cue.startSeconds < windowEnd)
    .map((cue) => cue.text)
    .join(" ")
    .trim();
}

export function buildTranscriptMinuteSegments(
  cues: VideoCaptionCue[],
  durationSeconds: number | undefined,
  intervalSeconds = DEFAULT_MARKER_INTERVAL_SECONDS,
): TranscriptMinuteSegment[] {
  const anchors = minuteMarkerAnchors(
    durationSeconds || cues[cues.length - 1]?.endSeconds || 0,
    intervalSeconds,
  );
  if (!anchors.length) return [];

  return anchors.map((atSeconds) => {
    const windowStart = Math.max(0, atSeconds - intervalSeconds);
    const windowEnd = atSeconds;
    return {
      atSeconds,
      windowStart,
      windowEnd,
      text: transcriptTextForWindow(cues, windowStart, windowEnd),
    };
  });
}

function segmentDigest(segments: TranscriptMinuteSegment[]) {
  return segments
    .map((segment) => {
      const range = `${formatTimestamp(segment.windowStart)}–${formatTimestamp(segment.windowEnd)}`;
      return `Stop at ${formatTimestamp(segment.atSeconds)} (covers ${range}):\n${segment.text || "(no transcript in this window)"}`;
    })
    .join("\n\n");
}

const GENERATED_MARKER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["atSeconds", "kind", "aiScript", "questionPrompt", "questionType", "options", "correctAnswer"],
  properties: {
    atSeconds: { type: "number", minimum: 0 },
    kind: { type: "string", enum: ["ai_say", "quick_check"] },
    aiScript: { type: ["string", "null"] },
    questionPrompt: { type: ["string", "null"] },
    questionType: {
      type: ["string", "null"],
      enum: ["shortAnswer", "multipleChoice", "trueFalse", null],
    },
    options: { type: ["array", "null"], items: { type: "string" } },
    correctAnswer: { type: ["string", "null"] },
  },
} as const;

type RawGeneratedMarker = {
  atSeconds?: number;
  kind?: VideoMarkerKind;
  aiScript?: string | null;
  questionPrompt?: string | null;
  questionType?: VideoTimelineMarker["questionType"] | null;
  options?: string[] | null;
  correctAnswer?: string | null;
};

function normalizeGeneratedMarker(
  raw: RawGeneratedMarker,
  fallbackAtSeconds: number,
): VideoTimelineMarker | null {
  const kind = raw.kind === "quick_check" ? "quick_check" : "ai_say";
  const atSeconds =
    typeof raw.atSeconds === "number" && Number.isFinite(raw.atSeconds)
      ? Math.max(0, Math.round(raw.atSeconds))
      : fallbackAtSeconds;

  if (kind === "quick_check") {
    const questionPrompt = raw.questionPrompt?.trim();
    if (!questionPrompt) return null;
    const questionType = raw.questionType || "shortAnswer";
    const options =
      questionType === "multipleChoice" || questionType === "trueFalse"
        ? (raw.options || []).map((option) => option.trim()).filter(Boolean)
        : undefined;
    return {
      id: createVideoId("marker"),
      atSeconds,
      kind,
      aiScript: raw.aiScript?.trim() || undefined,
      questionPrompt,
      questionType,
      options,
      correctAnswer: raw.correctAnswer?.trim() || undefined,
    };
  }

  const aiScript = raw.aiScript?.trim();
  if (!aiScript) return null;

  return {
    id: createVideoId("marker"),
    atSeconds,
    kind,
    aiScript,
  };
}

function fallbackMarkersFromSegments(segments: TranscriptMinuteSegment[]): VideoTimelineMarker[] {
  return segments
    .map((segment, index) => {
      const recap = segment.text.trim();
      if (!recap) return null;

      if (index % 3 === 2) {
        const snippet = recap.split(/(?<=[.!?])\s+/).find((part) => part.length > 20) || recap;
        return {
          id: createVideoId("marker"),
          atSeconds: segment.atSeconds,
          kind: "quick_check" as const,
          aiScript: "Quick check before we move on.",
          questionPrompt: `In your own words, what was the main point about "${snippet.slice(0, 80).trim()}"?`,
          questionType: "shortAnswer" as const,
          correctAnswer: snippet.slice(0, 200),
        };
      }

      return {
        id: createVideoId("marker"),
        atSeconds: segment.atSeconds,
        kind: "ai_say" as const,
        aiScript: `Let's pause for a moment. ${recap.slice(0, 220)}${recap.length > 220 ? "…" : ""}`,
      };
    })
    .filter((marker): marker is VideoTimelineMarker => Boolean(marker));
}

async function generateMarkersWithAi(
  segments: TranscriptMinuteSegment[],
  courseTitle: string,
  courseDescription: string | undefined,
): Promise<VideoTimelineMarker[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !segments.length) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        instructions:
          "You draft interactive video stop points for a safety-training instructor. Return JSON only. Each stop point should feel natural, concise, and grounded in the transcript segment it follows.",
        text: {
          format: {
            type: "json_schema",
            name: "video_course_markers",
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["markers"],
              properties: {
                markers: {
                  type: "array",
                  minItems: 1,
                  maxItems: MAX_MARKERS,
                  items: GENERATED_MARKER_SCHEMA,
                },
              },
            },
          },
        },
        input: [
          {
            role: "user",
            content: [
              `Course: ${courseTitle}${courseDescription ? ` — ${courseDescription}` : ""}`,
              "Create one stop point per minute segment below.",
              "Use `ai_say` for a short instructor recap or reflection (1-2 sentences in `aiScript`).",
              "Use `quick_check` about every third stop point for a brief comprehension question with `questionPrompt`, `questionType`, and `correctAnswer`.",
              "Keep `atSeconds` aligned with each segment's stop time.",
              "Do not invent facts that are not supported by the transcript segment.",
              segmentDigest(segments),
            ].join("\n\n"),
          },
        ],
      }),
    });

    const data = await response.json();
    if (!response.ok) return null;

    const parsed = JSON.parse(extractResponseOutputText(data) || "{}") as {
      markers?: RawGeneratedMarker[];
    };

    const markers = (parsed.markers || [])
      .map((raw, index) => normalizeGeneratedMarker(raw, segments[index]?.atSeconds || 0))
      .filter((marker): marker is VideoTimelineMarker => Boolean(marker));

    return markers.length ? sortVideoMarkers(markers) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateVideoMarkers(
  req: VideoMarkerGenerationRequest,
): Promise<VideoMarkerGenerationResult> {
  const warnings: string[] = [];
  const intervalSeconds = req.intervalSeconds || DEFAULT_MARKER_INTERVAL_SECONDS;
  const cues = parseWebVtt(req.vtt);
  const segments = buildTranscriptMinuteSegments(cues, req.durationSeconds, intervalSeconds);

  if (!segments.length) {
    return { markers: [], warnings: ["Video is too short for automatic stop points."] };
  }

  const aiMarkers = await generateMarkersWithAi(segments, req.courseTitle, req.courseDescription);
  if (aiMarkers?.length) {
    return { markers: aiMarkers, warnings };
  }

  warnings.push(
    process.env.OPENAI_API_KEY
      ? "AI stop-point generation failed — using transcript-based placeholders instead."
      : "No OPENAI_API_KEY configured — using transcript-based placeholders for stop points.",
  );

  return { markers: sortVideoMarkers(fallbackMarkersFromSegments(segments)), warnings };
}
