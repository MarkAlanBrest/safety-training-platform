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
