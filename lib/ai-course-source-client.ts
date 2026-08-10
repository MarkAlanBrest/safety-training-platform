"use client";

import { parsePptxBuffer, type ParsedSlideImage } from "@/lib/ppt-ingest-core";

const MAX_SOURCE_PICTURES = 12;
const MAX_PICTURE_BYTES = 300 * 1024;
const MAX_TOTAL_PICTURE_BYTES = 2_500 * 1024;

export type PreparedSourcePicture = {
  file: File;
  slideNumber: number;
  title: string;
  context: string;
  sourceName: string;
};

export type PreparedAiCourseSources = {
  uploadFiles: File[];
  pictures: PreparedSourcePicture[];
};

function slideDocument(fileName: string, slides: ReturnType<typeof parsePptxBuffer>) {
  return [
    `PowerPoint source: ${fileName}`,
    "The following content preserves original slide numbers, visible text, and speaker notes.",
    ...slides.map((slide) =>
      [
        `\n--- Slide ${slide.index + 1} ---`,
        `Title: ${slide.title}`,
        `Visible text: ${slide.bodyText}`,
        slide.bullets.length ? `Key points: ${slide.bullets.join(" | ")}` : "",
        slide.speakerNotes ? `Speaker notes: ${slide.speakerNotes}` : "",
        slide.image ? "Relevant embedded picture may be available from this slide." : "",
      ].filter(Boolean).join("\n"),
    ),
  ].join("\n");
}

async function imageBitmap(image: ParsedSlideImage) {
  const blob = new Blob([new Uint8Array(image.bytes)], { type: image.mimeType });
  return createImageBitmap(blob);
}

async function compressedPicture(image: ParsedSlideImage, name: string) {
  if (image.bytes.byteLength < 10 * 1024 || image.mimeType === "image/svg+xml") return null;
  try {
    const bitmap = await imageBitmap(image);
    if (bitmap.width < 480 || bitmap.height < 270 || bitmap.width * bitmap.height < 250_000) {
      bitmap.close();
      return null;
    }
    const scale = Math.min(1, 1280 / bitmap.width, 960 / bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    let quality = 0.72;
    let blob: Blob | null = null;
    do {
      blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      quality -= 0.1;
    } while (blob && blob.size > MAX_PICTURE_BYTES && quality >= 0.42);
    if (!blob || blob.size > MAX_PICTURE_BYTES) return null;
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    return null;
  }
}

export async function prepareAiCourseSources(
  files: File[],
  includePowerPointPictures: boolean,
): Promise<PreparedAiCourseSources> {
  const uploadFiles: File[] = [];
  const pictures: PreparedSourcePicture[] = [];
  let pictureBytes = 0;

  for (const file of files) {
    if (!file.name.toLowerCase().endsWith(".pptx")) {
      uploadFiles.push(file);
      continue;
    }

    const slides = parsePptxBuffer(new Uint8Array(await file.arrayBuffer()), {
      maxImageBytes: 6 * 1024 * 1024,
    });
    const baseName = file.name.replace(/\.pptx$/i, "");
    uploadFiles.push(
      new File([slideDocument(file.name, slides)], `${baseName}-powerpoint-content.txt`, {
        type: "text/plain",
      }),
    );

    if (!includePowerPointPictures) continue;
    for (const slide of slides) {
      if (!slide.image || pictures.length >= MAX_SOURCE_PICTURES || pictureBytes >= MAX_TOTAL_PICTURE_BYTES) break;
      const picture = await compressedPicture(
        slide.image,
        `ppt-picture-${pictures.length + 1}-slide-${slide.index + 1}.jpg`,
      );
      if (!picture || pictureBytes + picture.size > MAX_TOTAL_PICTURE_BYTES) continue;
      pictureBytes += picture.size;
      pictures.push({
        file: picture,
        slideNumber: slide.index + 1,
        title: slide.title,
        context: [slide.title, slide.bodyText, slide.speakerNotes, ...slide.bullets].join(" ").slice(0, 6000),
        sourceName: file.name,
      });
    }
  }

  return { uploadFiles, pictures };
}
