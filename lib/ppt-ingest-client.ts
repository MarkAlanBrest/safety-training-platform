"use client";

import {
  MAX_FILE_BYTES,
  type ParsedClassroomSlide,
  type ParsedSlideImage,
  parsePptxBuffer,
} from "@/lib/ppt-ingest-core";

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

export async function preparePptxForUpload(file: File): Promise<ParsedClassroomSlide[]> {
  if (!/\.pptx$/i.test(file.name)) {
    throw new Error("Only .pptx PowerPoint files are supported.");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("PowerPoint files are limited to 25 MB.");
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  const parsed = parsePptxBuffer(buffer);

  const imageSlideCount = parsed.filter((slide) => slide.image).length;
  const maxBytes = perSlideImageBudget(imageSlideCount);

  const prepared: ParsedClassroomSlide[] = [];
  for (const slide of parsed) {
    prepared.push({
      ...slide,
      image: slide.image ? await compressSlideImage(slide.image, maxBytes) : null,
    });
  }

  const totalImageBytes = prepared.reduce(
    (sum, slide) => sum + (slide.image?.bytes.byteLength || 0),
    0,
  );
  if (totalImageBytes > TOTAL_UPLOAD_IMAGE_BUDGET_BYTES) {
    throw new Error(
      "This deck has too many image-heavy slides to upload at once. Try splitting it into smaller presentations or compressing images in PowerPoint.",
    );
  }

  return prepared;
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
  form.set(
    "slides",
    JSON.stringify(
      parsedSlides.map((slide) => ({
        index: slide.index,
        title: slide.title,
        bodyText: slide.bodyText,
        speakerNotes: slide.speakerNotes,
        hasImage: Boolean(slide.image),
      })),
    ),
  );

  for (const slide of parsedSlides) {
    if (!slide.image) continue;
    form.set(
      `slide-image-${slide.index}`,
      new Blob([new Uint8Array(slide.image.bytes)], { type: slide.image.mimeType }),
      `slide-${slide.index}.jpg`,
    );
  }

  return form;
}
