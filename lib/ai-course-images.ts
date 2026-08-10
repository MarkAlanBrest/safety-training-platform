import type { GeneratedAiCourse } from "@/lib/ai-course-generator";
import type { AiCourseSource } from "@/lib/ai-course-generator";
import type { LessonMoment } from "@/lib/mason";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { createHash } from "node:crypto";
import { parsePptxBuffer, type ParsedSlideImage } from "@/lib/ppt-ingest-core";

const IMAGE_TIMEOUT_MS = 150_000;

type ImageResponse = {
  data?: Array<{ b64_json?: string }>;
  error?: { message?: string; code?: string };
};

async function generateCoursePicture(prompt: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_TIMEOUT_MS);
  try {
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
        prompt: [
          "Create a realistic, natural professional training photograph for an adult online course.",
          "The scene must be physically plausible, instructionally useful, and visually clear at landscape presentation size.",
          "Use believable people, equipment, environment, lighting, and personal protective equipment when appropriate.",
          "Do not include visible words, captions, labels, logos, watermarks, brand marks, graphic injuries, or decorative borders.",
          prompt.trim(),
        ].join("\n"),
        n: 1,
        size: "1536x1024",
        quality: "medium",
        output_format: "jpeg",
        output_compression: 72,
        background: "opaque",
      }),
    });
    const data = (await response.json()) as ImageResponse;
    if (!response.ok || !data.data?.[0]?.b64_json) {
      throw new Error(data.error?.message || "The course picture could not be generated.");
    }
    return `data:image/jpeg;base64,${data.data[0].b64_json}`;
  } finally {
    clearTimeout(timeout);
  }
}

type VisualTarget = {
  sectionIndex: number;
  momentIndex: number;
  moment: LessonMoment;
};

type SourcePicture = {
  dataUrl: string;
  slideNumber: number;
  context: string;
  title: string;
  sourceName?: string;
};

export type PowerPointPictureInput = {
  bytes: Buffer;
  mimeType: string;
  slideNumber: number;
  title: string;
  context: string;
  sourceName: string;
};

const STOP_WORDS = new Set([
  "about", "after", "again", "also", "and", "are", "before", "course", "from",
  "have", "into", "more", "that", "the", "their", "this", "through", "training",
  "use", "using", "when", "where", "which", "with", "your",
]);

function words(value: string) {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2 && !STOP_WORDS.has(word)),
  );
}

function relevanceScore(moment: LessonMoment, picture: SourcePicture) {
  const requested = words([
    moment.title,
    moment.imagePrompt,
    moment.sourceImageAlt,
    moment.explainerFrames?.[0]?.narration,
  ].filter(Boolean).join(" "));
  const available = words(picture.context);
  let matches = 0;
  requested.forEach((word) => {
    if (available.has(word)) matches += 1;
  });
  return matches / Math.max(1, Math.sqrt(requested.size * available.size));
}

async function pictureDataUrl(image: ParsedSlideImage) {
  if (image.bytes.byteLength < 8 * 1024 || image.mimeType === "image/svg+xml") return null;
  try {
    const bitmap = await loadImage(Buffer.from(image.bytes));
    if (bitmap.width < 280 || bitmap.height < 160 || bitmap.width * bitmap.height < 100_000) return null;
    const scale = Math.min(1, 1600 / bitmap.width, 1200 / bitmap.height);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = createCanvas(width, height);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);
    return `data:image/jpeg;base64,${canvas.toBuffer("image/jpeg", 78).toString("base64")}`;
  } catch {
    return null;
  }
}

async function extractPowerPointPictures(
  sources: AiCourseSource[],
  provided: PowerPointPictureInput[],
) {
  const pictures: SourcePicture[] = [];
  const seen = new Set<string>();
  for (const input of provided) {
    const hash = createHash("sha256").update(input.bytes).digest("hex");
    if (seen.has(hash)) continue;
    const dataUrl = await pictureDataUrl({ bytes: new Uint8Array(input.bytes), mimeType: input.mimeType });
    if (!dataUrl) continue;
    seen.add(hash);
    pictures.push({
      dataUrl,
      slideNumber: input.slideNumber,
      title: input.title,
      context: input.context,
      sourceName: input.sourceName,
    });
  }
  for (const source of sources.filter((item) => item.name.toLowerCase().endsWith(".pptx"))) {
    try {
      const slides = parsePptxBuffer(new Uint8Array(source.bytes), { maxImageBytes: 6 * 1024 * 1024 });
      for (const slide of slides) {
        for (const [imageIndex, image] of slide.images.entries()) {
          const hash = createHash("sha256").update(image.bytes).digest("hex");
          if (seen.has(hash)) continue;
          const dataUrl = await pictureDataUrl(image);
          if (!dataUrl) continue;
          seen.add(hash);
          pictures.push({
            dataUrl,
            slideNumber: slide.index + 1,
            title: image.label || `${slide.title} — picture ${imageIndex + 1}`,
            context: [image.label, slide.title, slide.bodyText, slide.speakerNotes, ...slide.bullets]
              .filter(Boolean)
              .join(" "),
            sourceName: source.name,
          });
        }
      }
    } catch (error) {
      console.error(`Could not extract course pictures from ${source.name}:`, error);
    }
  }
  return pictures;
}

function narrationSegments(value: string, count: number) {
  const narration = value.trim();
  if (count <= 1) return [narration];
  let parts = narration.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((part) => part.trim()).filter(Boolean) || [];
  if (parts.length < count) {
    const words = narration.split(/\s+/).filter(Boolean);
    const size = Math.max(1, Math.ceil(words.length / count));
    parts = Array.from({ length: count }, (_, index) => words.slice(index * size, (index + 1) * size).join(" "))
      .filter(Boolean);
  }
  return Array.from({ length: count }, (_, index) => {
    const start = Math.floor((index * parts.length) / count);
    const end = Math.max(start + 1, Math.floor(((index + 1) * parts.length) / count));
    return parts.slice(start, end).join(" ").trim() || narration;
  });
}

function pictureLabel(picture: SourcePicture, index: number) {
  const label = picture.title.replace(/\s+/g, " ").trim();
  return label && !/^slide \d+$/i.test(label) ? label.slice(0, 90) : `Visual ${index + 1}`;
}

/** Prefer relevant original PowerPoint pictures and retain their slide provenance. */
export async function attachPowerPointCoursePictures(
  course: GeneratedAiCourse,
  sources: AiCourseSource[],
  provided: PowerPointPictureInput[] = [],
) {
  const pictures = await extractPowerPointPictures(sources, provided);
  const used = new Set<number>();

  course.sections.forEach((section) => {
    const moment = section.lessonPlan.moments.find((item) => item.kind === "visual");
    if (!moment) return;
    const requestedSlide = Number(moment.pageNumber);
    const exactMatches = pictures
      .map((picture, index) => ({
        index,
        score:
          !used.has(index) && picture.slideNumber === requestedSlide
            ? relevanceScore(moment, picture)
            : -1,
      }))
      .filter((candidate) => candidate.score >= 0)
      .sort((a, b) => b.score - a.score);
    const ranked = pictures
      .map((picture, index) => ({
        index,
        score:
          relevanceScore(moment, picture) +
          (Number.isFinite(requestedSlide) && Math.abs(picture.slideNumber - requestedSlide) <= 1 ? 0.08 : 0),
      }))
      .sort((a, b) => b.score - a.score);
    const selectedIndexes = [
      ...exactMatches.map((candidate) => candidate.index),
      ...ranked.filter((candidate) => !used.has(candidate.index)).map((candidate) => candidate.index),
      ...ranked.map((candidate) => candidate.index),
    ].filter((index, position, all) => all.indexOf(index) === position).slice(0, Math.min(4, pictures.length));
    if (!selectedIndexes.length) return;

    const selected = selectedIndexes.map((index) => pictures[index]);
    selectedIndexes.forEach((index) => used.add(index));
    const originalNarration = moment.explainerFrames?.[0]?.narration?.trim() || moment.narration.trim();
    const segments = narrationSegments(originalNarration, selected.length);
    const firstPicture = selected[0];
    moment.pageNumber = firstPicture.slideNumber;
    moment.sourceImage = firstPicture.dataUrl;
    moment.sourceImageAlt = `Source PowerPoint${firstPicture.sourceName ? ` ${firstPicture.sourceName}` : ""}, slide ${firstPicture.slideNumber}: ${firstPicture.title}`;
    moment.explainerStyle = selected.length > 1 ? "step-build" : "flipbook";
    moment.explainerFrames = selected.map((picture, index) => ({
      title: pictureLabel(picture, index),
      caption: `PowerPoint slide ${picture.slideNumber}`,
      narration: segments[index],
      visualItems: [],
      sourceImage: picture.dataUrl,
    }));
    moment.playerFrames = null;
  });

  course.sections.forEach((section) => {
    section.lessonPlan.moments = section.lessonPlan.moments.map((moment) => {
      if (moment.kind !== "visual" || moment.sourceImage || moment.explainerFrames?.[0]?.sourceImage) {
        return moment;
      }
      const narration = moment.explainerFrames?.[0]?.narration?.trim() || moment.narration;
      return {
        ...moment,
        kind: "explain",
        narration,
        imagePrompt: null,
        sourceImage: null,
        explainerFrames: null,
        playerFrames: null,
      };
    });
  });
  return course;
}

/** Add one meaningful, editable photograph per chapter without allowing a failed image to block the course. */
export async function addGeneratedCoursePictures(course: GeneratedAiCourse) {
  const targets: VisualTarget[] = [];
  course.sections.forEach((section, sectionIndex) => {
    const momentIndex = section.lessonPlan.moments.findIndex(
      (moment) =>
        moment.kind === "visual" &&
        !moment.sourceImage &&
        !moment.explainerFrames?.[0]?.sourceImage &&
        Boolean(moment.imagePrompt?.trim()),
    );
    if (momentIndex >= 0) {
      targets.push({ sectionIndex, momentIndex, moment: section.lessonPlan.moments[momentIndex] });
    }
  });

  const results = await Promise.allSettled(
    targets.map((target) => generateCoursePicture(target.moment.imagePrompt || target.moment.title)),
  );

  results.forEach((result, index) => {
    const target = targets[index];
    if (result.status !== "fulfilled") {
      console.error("AI course picture generation failed:", result.reason);
      return;
    }
    const moment = course.sections[target.sectionIndex].lessonPlan.moments[target.momentIndex];
    const frame = moment.explainerFrames?.[0];
    if (frame) frame.sourceImage = result.value;
    moment.sourceImage = result.value;
  });

  return course;
}
