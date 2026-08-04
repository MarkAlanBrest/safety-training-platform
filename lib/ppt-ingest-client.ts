"use client";

import {
  MAX_FILE_BYTES,
  type ParsedClassroomSlide,
  parsePptxBuffer,
} from "@/lib/ppt-ingest-core";
import { captureSlidesFromPptx } from "@/lib/ppt-slide-capture-client";

export type PreparedContentSlide = {
  index: number;
  title: string;
  teachingContent: string;
  imageFile: File;
  previewUrl: string;
};

function assertPptxFile(file: File) {
  if (!/\.pptx$/i.test(file.name)) {
    throw new Error("Only .pptx PowerPoint files are supported.");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("PowerPoint files are limited to 25 MB.");
  }
}

function fileFromImageBytes(
  image: { bytes: Uint8Array; mimeType: string },
  index: number,
) {
  const blob = new Blob([new Uint8Array(image.bytes)], { type: image.mimeType });
  const extension = image.mimeType.includes("png")
    ? "png"
    : image.mimeType.includes("webp")
      ? "webp"
      : "jpg";
  const file = new File([blob], `slide-${index + 1}.${extension}`, { type: image.mimeType });
  return { imageFile: file, previewUrl: URL.createObjectURL(blob) };
}

export function teachingContentFromParsedSlide(slide: ParsedClassroomSlide) {
  if (slide.speakerNotes.trim()) return slide.speakerNotes.trim();
  if (slide.bullets.length) return slide.bullets.join("\n");
  if (slide.bodyText.trim()) return slide.bodyText.trim();
  return "";
}

/**
 * Parse a PowerPoint deck, render each slide to an image, and map speaker notes
 * into content-slide teaching scripts.
 */
export async function prepareContentSlidesFromPptx(
  file: File,
  onProgress?: (message: string) => void,
): Promise<PreparedContentSlide[]> {
  assertPptxFile(file);

  onProgress?.("Reading slides and speaker notes…");
  const buffer = new Uint8Array(await file.arrayBuffer());
  const parsed = parsePptxBuffer(buffer);

  onProgress?.("Converting slides to pictures…");
  const rendered = await captureSlidesFromPptx(file, parsed.length, (current, total) => {
    onProgress?.(`Converting slide ${current} of ${total}…`);
  });

  const prepared: PreparedContentSlide[] = parsed.map((slide, index) => {
    const renderedImage = rendered[index];
    if (!renderedImage?.bytes.byteLength) {
      throw new Error(`Slide ${index + 1} did not convert to a picture.`);
    }

    const { imageFile, previewUrl } = fileFromImageBytes(renderedImage, index);

    return {
      index,
      title: slide.title,
      teachingContent: teachingContentFromParsedSlide(slide),
      imageFile,
      previewUrl,
    };
  });

  onProgress?.(`Ready — ${prepared.length} content slides prepared.`);
  return prepared;
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

  onProgress?.("Reading slides and speaker notes…", 10);
  const parsed = parsePptxBuffer(new Uint8Array(await file.arrayBuffer()));
  onProgress?.("Preparing speaker notes and slide text…", 80);
  const prepared = parsed.map((slide) => ({
    ...slide,
    images: [],
    image: null,
    renderedSlide: null,
  }));
  onProgress?.("Ready for slide images", 100);
  return prepared;
}

function slideMetadata(slides: ParsedClassroomSlide[]) {
  return JSON.stringify(
    slides.map((slide) => ({
      index: slide.index,
      title: slide.title,
      bodyText: slide.bodyText,
      speakerNotes: slide.speakerNotes,
      bullets: slide.bullets,
      hasImage: false,
      imageCount: 0,
      hasRenderedSlide: false,
    })),
  );
}

function setCommonFields(
  form: FormData,
  fields: { title: string; description: string; published: boolean; config: unknown },
) {
  form.set("title", fields.title);
  form.set("description", fields.description);
  form.set("published", fields.published ? "true" : "false");
  form.set("config", JSON.stringify(fields.config));
  form.set("stagedAssets", "true");
}

export function buildClassroomUploadFormData(
  file: File,
  slideImagesZip: File,
  parsedSlides: ParsedClassroomSlide[],
  fields: {
    title: string;
    description: string;
    published: boolean;
    config: unknown;
  },
) {
  const form = new FormData();
  setCommonFields(form, fields);
  form.set("sourceFileName", file.name);
  void slideImagesZip;
  form.set("slides", slideMetadata(parsedSlides));
  return form;
}

export function buildMultiChapterUploadFormData(
  chapters: Array<{
    file: File;
    slideImagesZip: File;
    title: string;
    parsedSlides: ParsedClassroomSlide[];
  }>,
  fields: {
    title: string;
    description: string;
    published: boolean;
    config: unknown;
  },
) {
  const form = new FormData();
  setCommonFields(form, fields);
  form.set("sourceFileName", chapters[0]?.file.name || "classroom.pptx");
  form.set("chapters", JSON.stringify(chapters.map((chapter) => ({ title: chapter.title }))));

  chapters.forEach((chapter, chapterIndex) => {
    void chapter.file;
    void chapter.slideImagesZip;
    form.set(chapterIndex === 0 ? "slides" : `slides-${chapterIndex}`, slideMetadata(chapter.parsedSlides));
  });

  return form;
}
