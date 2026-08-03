"use client";

import {
  MAX_FILE_BYTES,
  type ParsedClassroomSlide,
  type ParsedSlideImage,
  parsePptxBuffer,
} from "@/lib/ppt-ingest-core";

const MAX_UPLOAD_IMAGE_BYTES = 280 * 1024;

async function compressSlideImage(image: ParsedSlideImage): Promise<ParsedSlideImage> {
  if (image.mimeType === "image/svg+xml" || image.bytes.byteLength <= MAX_UPLOAD_IMAGE_BYTES) {
    return image;
  }

  if (typeof document === "undefined") return image;

  try {
    const blob = new Blob([new Uint8Array(image.bytes)], { type: image.mimeType });
    const bitmap = await createImageBitmap(blob);
    const maxWidth = 960;
    const scale = Math.min(1, maxWidth / bitmap.width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) return image;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const output = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.74),
    );
    if (!output) return image;

    const bytes = new Uint8Array(await output.arrayBuffer());
    if (bytes.byteLength > MAX_UPLOAD_IMAGE_BYTES) return image;

    return {
      bytes,
      mimeType: "image/jpeg",
    };
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

  const prepared: ParsedClassroomSlide[] = [];
  for (const slide of parsed) {
    prepared.push({
      ...slide,
      image: slide.image ? await compressSlideImage(slide.image) : null,
    });
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
