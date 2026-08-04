"use client";

import {
  MAX_FILE_BYTES,
  type ParsedClassroomSlide,
  parsePptxBuffer,
} from "@/lib/ppt-ingest-core";

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
