"use client";

import {
  MAX_FILE_BYTES,
  type ParsedClassroomSlide,
  type ParsedSlideImage,
  parsePptxBuffer,
} from "@/lib/ppt-ingest-core";
import { captureSlidesFromPptx } from "@/lib/ppt-slide-capture-client";

const MAX_UPLOAD_IMAGE_BYTES = 280 * 1024;
const TOTAL_UPLOAD_IMAGE_BUDGET_BYTES = 3.5 * 1024 * 1024;

function perSlideImageBudget(imageSlideCount: number) {
  if (imageSlideCount <= 0) return MAX_UPLOAD_IMAGE_BYTES;
  return Math.min(
    MAX_UPLOAD_IMAGE_BYTES,
    Math.floor(TOTAL_UPLOAD_IMAGE_BUDGET_BYTES / imageSlideCount),
  );
}

async function compressSlideImage(
  image: ParsedSlideImage,
  maxBytes: number,
): Promise<ParsedSlideImage> {
  if (image.mimeType === "image/svg+xml" && image.bytes.byteLength <= maxBytes) {
    return image;
  }
  if (image.bytes.byteLength <= maxBytes && image.mimeType !== "image/svg+xml") {
    return image;
  }

  if (typeof document === "undefined") return image;

  try {
    const blob = new Blob([new Uint8Array(image.bytes)], { type: image.mimeType });
    const bitmap = await createImageBitmap(blob);
    const attempts = [
      { maxWidth: 960, quality: 0.74 },
      { maxWidth: 800, quality: 0.68 },
      { maxWidth: 640, quality: 0.62 },
      { maxWidth: 480, quality: 0.55 },
    ];

    for (const attempt of attempts) {
      const scale = Math.min(1, attempt.maxWidth / bitmap.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (!context) break;
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      const output = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", attempt.quality),
      );
      if (!output) continue;

      const bytes = new Uint8Array(await output.arrayBuffer());
      if (bytes.byteLength <= maxBytes) {
        bitmap.close();
        return {
          bytes,
          mimeType: "image/jpeg",
        };
      }
    }

    bitmap.close();
    return image;
  } catch {
    return image;
  }
}

export async function preparePptxForUpload(
  file: File,
  onProgress?: (message: string, percent: number) => void,
): Promise<ParsedClassroomSlide[]> {
  if (!/\.pptx$/i.test(file.name)) {
    throw new Error("Only .pptx PowerPoint files are supported.");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("PowerPoint files are limited to 25 MB.");
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  onProgress?.("Reading slides…", 5);
  const parsed = parsePptxBuffer(buffer);

  onProgress?.("Rendering slides from your PowerPoint…", 15);
  const renderedSlides = await captureSlidesFromPptx(file, parsed.length, (current, total) => {
    const percent = 15 + Math.round((current / total) * 55);
    onProgress?.(`Rendering slide ${current} of ${total}…`, percent);
  });

  const imageSlideCount = parsed.reduce(
    (count, slide) => count + Math.max(slide.images.length, slide.image ? 1 : 0),
    0,
  );
  const maxBytes = perSlideImageBudget(imageSlideCount);

  onProgress?.("Preparing upload…", 75);
  const prepared: ParsedClassroomSlide[] = [];
  for (let index = 0; index < parsed.length; index += 1) {
    const slide = parsed[index];
    const renderedSlide = renderedSlides[index] || null;
    const images = renderedSlide
      ? []
      : await Promise.all(slide.images.map((image) => compressSlideImage(image, maxBytes)));
    prepared.push({
      ...slide,
      images,
      image: images[0] || null,
      renderedSlide,
    });
  }

  const totalImageBytes = prepared.reduce((sum, slide) => {
    const renderBytes = slide.renderedSlide?.bytes.byteLength || 0;
    const embeddedBytes = slide.images.reduce(
      (imageSum, image) => imageSum + image.bytes.byteLength,
      0,
    );
    return sum + renderBytes + embeddedBytes;
  }, 0);
  const totalRenderBudget = 22 * 1024 * 1024;
  if (totalImageBytes > totalRenderBudget) {
    throw new Error(
      "This deck is too large to upload at once after rendering slides. Try splitting it into smaller chapters or reducing slide count.",
    );
  }
  if (
    !renderedSlides.some(Boolean) &&
    totalImageBytes > TOTAL_UPLOAD_IMAGE_BUDGET_BYTES
  ) {
    throw new Error(
      "This deck has too many image-heavy slides to upload at once. Try splitting it into smaller presentations or compressing images in PowerPoint.",
    );
  }

  onProgress?.("Ready to upload", 100);
  return prepared;
}

function renderFileExtension(mimeType: string) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

export function buildClassroomUploadFormData(
  file: File,
  parsedSlides: ParsedClassroomSlide[],
  fields: {
    title: string;
    description: string;
    published: boolean;
    config: unknown;
  },
) {
  const form = new FormData();
  form.set("title", fields.title);
  form.set("description", fields.description);
  form.set("published", fields.published ? "true" : "false");
  form.set("config", JSON.stringify(fields.config));
  form.set("sourceFileName", file.name);
  form.set("pptx", file, file.name);
  form.set(
    "slides",
    JSON.stringify(
      parsedSlides.map((slide) => ({
        index: slide.index,
        title: slide.title,
        bodyText: slide.bodyText,
        speakerNotes: slide.speakerNotes,
        bullets: slide.bullets,
        hasImage: Boolean(slide.image),
        imageCount: slide.images.length,
        hasRenderedSlide: Boolean(slide.renderedSlide),
      })),
    ),
  );

  for (const slide of parsedSlides) {
    if (slide.renderedSlide) {
      const ext = renderFileExtension(slide.renderedSlide.mimeType);
      form.set(
        `slide-render-${slide.index}`,
        new Blob([new Uint8Array(slide.renderedSlide.bytes)], {
          type: slide.renderedSlide.mimeType,
        }),
        `slide-${slide.index}-render.${ext}`,
      );
      continue;
    }
    slide.images.forEach((image, imageIndex) => {
      form.set(
        `slide-image-${slide.index}-${imageIndex}`,
        new Blob([new Uint8Array(image.bytes)], { type: image.mimeType }),
        `slide-${slide.index}-${imageIndex}.jpg`,
      );
    });
  }

  return form;
}

export function buildMultiChapterUploadFormData(
  chapters: Array<{ file: File; title: string; parsedSlides: ParsedClassroomSlide[] }>,
  fields: {
    title: string;
    description: string;
    published: boolean;
    config: unknown;
  },
) {
  const form = new FormData();
  form.set("title", fields.title);
  form.set("description", fields.description);
  form.set("published", fields.published ? "true" : "false");
  form.set("config", JSON.stringify(fields.config));
  form.set("sourceFileName", chapters[0]?.file.name || "classroom.pptx");
  form.set(
    "chapters",
    JSON.stringify(chapters.map((chapter) => ({ title: chapter.title }))),
  );

  chapters.forEach((chapter, chapterIndex) => {
    const pptxKey = chapterIndex === 0 ? "pptx" : `chapter-${chapterIndex}-pptx`;
    form.set(pptxKey, chapter.file, chapter.file.name);

    const slidesKey = chapterIndex === 0 ? "slides" : `slides-${chapterIndex}`;
    form.set(
      slidesKey,
      JSON.stringify(
        chapter.parsedSlides.map((slide) => ({
          index: slide.index,
          title: slide.title,
          bodyText: slide.bodyText,
          speakerNotes: slide.speakerNotes,
          bullets: slide.bullets,
          hasImage: Boolean(slide.image),
          imageCount: slide.images.length,
          hasRenderedSlide: Boolean(slide.renderedSlide),
        })),
      ),
    );

    for (const slide of chapter.parsedSlides) {
      const renderPrefix =
        chapterIndex === 0
          ? `slide-render-${slide.index}`
          : `chapter-${chapterIndex}-slide-render-${slide.index}`;
      if (slide.renderedSlide) {
        const ext = renderFileExtension(slide.renderedSlide.mimeType);
        form.set(
          renderPrefix,
          new Blob([new Uint8Array(slide.renderedSlide.bytes)], {
            type: slide.renderedSlide.mimeType,
          }),
          `chapter-${chapterIndex}-slide-${slide.index}-render.${ext}`,
        );
        continue;
      }
      const prefix =
        chapterIndex === 0
          ? `slide-image-${slide.index}`
          : `chapter-${chapterIndex}-slide-image-${slide.index}`;
      slide.images.forEach((image, imageIndex) => {
        form.set(
          `${prefix}-${imageIndex}`,
          new Blob([new Uint8Array(image.bytes)], { type: image.mimeType }),
          `chapter-${chapterIndex}-slide-${slide.index}-${imageIndex}.jpg`,
        );
      });
    }
  });

  return form;
}
