import type { ClassroomSlideHotspot } from "@/lib/classroom-focus";
import { bytesToBase64 } from "@/lib/ppt-ingest-core";
import type { ParsedSlideImage } from "@/lib/ppt-ingest";
import { extractResponseOutputText } from "@/lib/parse-response";

function fallbackHotspots(title: string, bodyText: string): ClassroomSlideHotspot[] {
  const snippets = bodyText
    .split(/(?:•|;|\n|(?<=[.!?])\s+)/)
    .map((part) => part.trim())
    .filter((part) => part.length > 10)
    .slice(0, 4);

  if (!snippets.length) {
    return [
      {
        id: "feature-1",
        label: title.slice(0, 48) || "Main feature",
        description: bodyText.slice(0, 180) || "Key detail on this slide.",
        x: 50,
        y: 50,
      },
    ];
  }

  const columns = Math.min(3, snippets.length);
  return snippets.map((snippet, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    return {
      id: `feature-${index + 1}`,
      label: snippet.split(/[.!?]/)[0]?.slice(0, 64) || `Feature ${index + 1}`,
      description: snippet,
      x: 20 + column * 30,
      y: 28 + row * 24,
    };
  });
}

export type SlideClickTarget = {
  label: string;
  description: string;
  targetX: number;
  targetY: number;
  toleranceRadius: number;
};

/**
 * Like analyzeSlideHotspots, but returns exactly one click target meant to be
 * graded as a learner quiz answer (click-the-spot), not just an AI pointing hint.
 */
export async function analyzeSlideForClickTarget(input: {
  title: string;
  bodyText: string;
  speakerNotes?: string;
  image?: ParsedSlideImage | null;
}): Promise<SlideClickTarget | null> {
  if (!input.image) return null;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const mimeType = input.image.mimeType || "image/jpeg";
  const dataUrl = `data:${mimeType};base64,${bytesToBase64(input.image.bytes)}`;

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5.6-sol",
        instructions:
          "You write click-the-spot quiz questions from training slide images. Pick the single most teachable, unambiguous visual feature a learner should be able to click on. Return JSON only.",
        text: {
          format: {
            type: "json_schema",
            name: "classroom_click_target",
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["label", "description", "targetX", "targetY", "toleranceRadius"],
              properties: {
                label: { type: "string" },
                description: { type: "string" },
                targetX: { type: "number", minimum: 0, maximum: 100 },
                targetY: { type: "number", minimum: 0, maximum: 100 },
                toleranceRadius: { type: "number", minimum: 4, maximum: 20 },
              },
            },
          },
        },
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: [
                  `Slide title: ${input.title}`,
                  `Slide text: ${input.bodyText}`,
                  `Speaker notes: ${input.speakerNotes || "(none)"}`,
                  "Identify the single correct click target for a learner quiz question (e.g. a hazard, part, label, or control).",
                  "Place targetX/targetY as percentages from the top-left of the image, and toleranceRadius as a percent of the image size that should still count as correct.",
                ].join("\n"),
              },
              {
                type: "input_image",
                image_url: dataUrl,
              },
            ],
          },
        ],
      }),
    });

    const data = await response.json();
    if (!response.ok) return null;

    const parsed = JSON.parse(extractResponseOutputText(data) || "{}") as Partial<SlideClickTarget>;
    if (typeof parsed.targetX !== "number" || typeof parsed.targetY !== "number") return null;

    return {
      label: parsed.label || input.title.slice(0, 48) || "Click target",
      description: parsed.description || "",
      targetX: Math.min(100, Math.max(0, parsed.targetX)),
      targetY: Math.min(100, Math.max(0, parsed.targetY)),
      toleranceRadius: Math.min(20, Math.max(4, parsed.toleranceRadius ?? 8)),
    };
  } catch {
    return null;
  }
}

export async function analyzeSlideHotspots(input: {
  title: string;
  bodyText: string;
  speakerNotes?: string;
  image?: ParsedSlideImage | null;
}): Promise<ClassroomSlideHotspot[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !input.image) {
    return fallbackHotspots(input.title, input.bodyText);
  }

  const mimeType = input.image.mimeType || "image/jpeg";
  const dataUrl = `data:${mimeType};base64,${bytesToBase64(input.image.bytes)}`;

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5.6-sol",
        instructions:
          "You analyze training slide images and return hotspot coordinates for an AI instructor to point at while teaching. Return JSON only.",
        text: {
          format: {
            type: "json_schema",
            name: "classroom_slide_hotspots",
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["hotspots"],
              properties: {
                hotspots: {
                  type: "array",
                  minItems: 1,
                  maxItems: 8,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["id", "label", "description", "x", "y"],
                    properties: {
                      id: { type: "string" },
                      label: { type: "string" },
                      description: { type: "string" },
                      x: { type: "number", minimum: 0, maximum: 100 },
                      y: { type: "number", minimum: 0, maximum: 100 },
                    },
                  },
                },
              },
            },
          },
        },
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: [
                  `Slide title: ${input.title}`,
                  `Slide text: ${input.bodyText}`,
                  `Speaker notes: ${input.speakerNotes || "(none)"}`,
                  "Identify the most teachable visual features on this slide image (lines, symbols, labels, parts, hazards, dimensions, etc.).",
                  "Place x and y as percentages from the top-left of the image.",
                ].join("\n"),
              },
              {
                type: "input_image",
                image_url: dataUrl,
              },
            ],
          },
        ],
      }),
    });

    const data = await response.json();
    if (!response.ok) return fallbackHotspots(input.title, input.bodyText);

    const parsed = JSON.parse(extractResponseOutputText(data) || "{}") as {
      hotspots?: ClassroomSlideHotspot[];
    };
    if (!parsed.hotspots?.length) return fallbackHotspots(input.title, input.bodyText);
    return parsed.hotspots.map((hotspot, index) => ({
      id: hotspot.id || `feature-${index + 1}`,
      label: hotspot.label,
      description: hotspot.description,
      x: Math.min(100, Math.max(0, hotspot.x)),
      y: Math.min(100, Math.max(0, hotspot.y)),
    }));
  } catch {
    return fallbackHotspots(input.title, input.bodyText);
  }
}
