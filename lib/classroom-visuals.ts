import type { ClassroomSlide, ClassroomSlideVisual } from "@/lib/classroom";
import { bytesToBase64 } from "@/lib/ppt-ingest-core";
import type { ParsedSlideImage } from "@/lib/ppt-ingest";
import { extractResponseOutputText } from "@/lib/parse-response";

export async function labelSlideImage(input: {
  title: string;
  bodyText: string;
  speakerNotes?: string;
  image: ParsedSlideImage;
  imageIndex: number;
  imageCount: number;
}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  const fallback =
    input.image.label ||
    input.title ||
    `Slide picture ${input.imageIndex + 1}`;

  if (!apiKey) return fallback;

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
          "You label training slide pictures so an instructor can pick the right image when teaching. Return JSON only.",
        text: {
          format: {
            type: "json_schema",
            name: "slide_visual_label",
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["label"],
              properties: {
                label: { type: "string" },
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
                  `This is picture ${input.imageIndex + 1} of ${input.imageCount} on the slide.`,
                  "Write a short, specific label for what this picture shows (e.g. Hidden line, Center line, Extension ladder setup).",
                  "Use terminology from the slide when possible.",
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
    if (!response.ok) return fallback;

    const parsed = JSON.parse(extractResponseOutputText(data) || "{}") as {
      label?: string;
    };
    return parsed.label?.trim() || fallback;
  } catch {
    return fallback;
  }
}

export async function buildLabeledVisuals(
  slide: {
    index: number;
    title: string;
    bodyText: string;
    speakerNotes: string;
    bullets: string[];
    images: ParsedSlideImage[];
  },
  courseSlug: string,
): Promise<ClassroomSlideVisual[]> {
  if (!slide.images.length) return [];

  const labels = await Promise.all(
    slide.images.map((image, imageIndex) =>
      labelSlideImage({
        title: slide.title,
        bodyText: slide.bodyText,
        speakerNotes: slide.speakerNotes,
        image,
        imageIndex,
        imageCount: slide.images.length,
      }),
    ),
  );

  return slide.images.map((_, imageIndex) => ({
    label: labels[imageIndex] || slide.bullets[imageIndex] || slide.title,
    imageUrl:
      imageIndex === 0
        ? `/api/classroom/${courseSlug}/slides/${slide.index}`
        : `/api/classroom/${courseSlug}/slides/${slide.index}/${imageIndex}`,
  }));
}

export function visualIndexForTopic(
  slide: ClassroomSlide,
  topic: string,
): number | undefined {
  if (!slide.visuals?.length) return undefined;

  const normalized = topic.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
  if (!normalized) return 0;

  let bestIndex = 0;
  let bestScore = 0;

  slide.visuals.forEach((visual, index) => {
    const label = visual.label.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
    if (!label) return;
    if (normalized.includes(label) || label.includes(normalized)) {
      bestScore = 1;
      bestIndex = index;
      return;
    }
    const topicWords = normalized.split(/\s+/).filter((word) => word.length > 2);
    const labelWords = label.split(/\s+/).filter((word) => word.length > 2);
    const overlap = topicWords.filter((word) =>
      labelWords.some((labelWord) => labelWord.includes(word) || word.includes(labelWord)),
    ).length;
    const score = overlap / Math.max(topicWords.length, labelWords.length, 1);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  return bestScore >= 0.25 ? bestIndex : 0;
}

export function resolveImageIndexFromTeaching(
  slide: ClassroomSlide,
  parts: Array<string | undefined | null>,
): number | undefined {
  for (const part of parts) {
    if (!part?.trim()) continue;
    const index = visualIndexForTopic(slide, part);
    if (typeof index === "number") return index;
  }
  return slide.visuals?.length ? 0 : undefined;
}

function topicMatchScore(topic: string, candidate: string) {
  const normalizedTopic = topic.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
  const normalizedCandidate = candidate.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
  if (!normalizedTopic || !normalizedCandidate) return 0;
  if (normalizedTopic === normalizedCandidate) return 1;
  if (
    normalizedTopic.includes(normalizedCandidate) ||
    normalizedCandidate.includes(normalizedTopic)
  ) {
    return 0.9;
  }
  const topicWords = normalizedTopic.split(/\s+/).filter((word) => word.length > 2);
  const candidateWords = normalizedCandidate.split(/\s+/).filter((word) => word.length > 2);
  const overlap = topicWords.filter((word) =>
    candidateWords.some(
      (candidateWord) => candidateWord.includes(word) || word.includes(candidateWord),
    ),
  ).length;
  return overlap / Math.max(topicWords.length, candidateWords.length, 1);
}

export function findSlideIndexForTopic(
  slides: ClassroomSlide[],
  topic: string,
  currentIndex = 0,
): number {
  let bestIndex = currentIndex;
  let bestScore = topicMatchScore(topic, slides[currentIndex]?.title || "");

  slides.forEach((slide, index) => {
    const titleScore = topicMatchScore(topic, slide.title);
    const bulletScore = Math.max(
      ...(slide.bullets || []).map((bullet) => topicMatchScore(topic, bullet)),
      0,
    );
    const visualScore = Math.max(
      ...(slide.visuals || []).map((visual) => topicMatchScore(topic, visual.label)),
      0,
    );
    const score = Math.max(titleScore, bulletScore, visualScore);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  return bestScore >= 0.45 ? bestIndex : currentIndex;
}
