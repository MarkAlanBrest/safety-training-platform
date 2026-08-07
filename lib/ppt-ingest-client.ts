"use client";

import {
  MAX_FILE_BYTES,
  type ParsedClassroomSlide,
  parsePptxBuffer,
  teachingContentFromParsedSlide,
} from "@/lib/ppt-ingest-core";
import { captureSlidesFromPptx } from "@/lib/ppt-slide-capture-client";
import { parseJsonResponse } from "@/lib/parse-response";

export { teachingContentFromParsedSlide } from "@/lib/ppt-ingest-core";

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

export type ParsedTeachingSlide = {
  title: string;
  teachingContent: string;
};

/** Read speaker notes and titles from a PowerPoint without rendering slide images. */
export async function parsePptxTeachingNotes(file: File): Promise<ParsedTeachingSlide[]> {
  assertPptxFile(file);
  const parsed = parsePptxBuffer(new Uint8Array(await file.arrayBuffer()));
  return parsed.map((slide) => ({
    title: slide.title,
    teachingContent: teachingContentFromParsedSlide(slide),
  }));
}

/** Import speaker notes and titles from a PowerPoint without generating slide images. */
export async function prepareContentSlidesFromPptxNotesOnly(
  file: File,
  onProgress?: (message: string) => void,
): Promise<Array<{ index: number; title: string; teachingContent: string }>> {
  assertPptxFile(file);
  onProgress?.("Reading speaker notes from PowerPoint…");
  const notes = await parsePptxTeachingNotes(file);
  onProgress?.(`Ready — ${notes.length} slides prepared.`);
  return notes.map((note, index) => ({
    index,
    title: note.title,
    teachingContent: note.teachingContent,
  }));
}

function contentSlidesFromImagesAndNotes(
  images: Array<{ bytes: Uint8Array; mimeType: string }>,
  notes: ParsedTeachingSlide[],
): PreparedContentSlide[] {
  if (notes.length && notes.length !== images.length) {
    throw new Error(
      `The ZIP has ${images.length} slide image${images.length === 1 ? "" : "s"}, but the PowerPoint has ${notes.length}. Export the same number of pictures as slides, in order.`,
    );
  }

  return images.map((image, index) => {
    const note = notes[index];
    const { imageFile, previewUrl } = fileFromImageBytes(image, index);
    return {
      index,
      title: note?.title || `Slide ${index + 1}`,
      teachingContent: note?.teachingContent || "",
      imageFile,
      previewUrl,
    };
  });
}

/**
 * Build content slides from exported slide images plus optional PowerPoint notes.
 */
export async function prepareContentSlidesFromZipAndPptx(
  zipFile: File,
  pptxFile: File | null,
  onProgress?: (message: string) => void,
): Promise<PreparedContentSlide[]> {
  const { extractImagesFromZip } = await import("@/lib/ppt-slide-images");

  onProgress?.("Reading slide images…");
  const images = extractImagesFromZip(new Uint8Array(await zipFile.arrayBuffer()));
  if (!images.length) {
    throw new Error("No slide images were found in the ZIP.");
  }

  let notes: ParsedTeachingSlide[] = [];
  if (pptxFile) {
    onProgress?.("Reading speaker notes from PowerPoint…");
    notes = await parsePptxTeachingNotes(pptxFile);
  }

  const prepared = contentSlidesFromImagesAndNotes(images, notes);
  onProgress?.(`Ready — ${prepared.length} content slides prepared.`);
  return prepared;
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

  onProgress?.("Rendering slides on the server…");
  try {
  const form = new FormData();
  form.set("pptx", file);
  const response = await fetch("/api/classroom/render-pptx", {
    method: "POST",
    body: form,
  });
  const data = await parseJsonResponse<{
    error?: string;
    slides: Array<{
      index: number;
      title: string;
      teachingContent: string;
      imageBase64: string;
      mimeType: string;
    }>;
  }>(response);

  if (response.ok && data.slides?.length) {
    onProgress?.(`Ready — ${data.slides.length} content slides prepared.`);
    return data.slides.map((slide) => {
      const bytes = Uint8Array.from(atob(slide.imageBase64), (char) => char.charCodeAt(0));
      const { imageFile, previewUrl } = fileFromImageBytes(
        { bytes, mimeType: slide.mimeType },
        slide.index,
      );
      return {
        index: slide.index,
        title: slide.title,
        teachingContent: slide.teachingContent,
        imageFile,
        previewUrl,
      };
    });
  }

  if (!response.ok) {
    throw new Error(data.error || "Server rendering failed.");
  }
  } catch (serverError) {
    console.warn("Server PPTX render failed, falling back to browser:", serverError);
    onProgress?.(
      serverError instanceof Error
        ? `${serverError.message} Trying browser conversion…`
        : "Trying browser conversion…",
    );
  }

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
