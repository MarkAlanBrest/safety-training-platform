import type { ClassroomSlide } from "@/lib/classroom";
import {
  type ParsedClassroomSlide,
  parsePptxBuffer,
} from "@/lib/ppt-ingest-core";

const SERVER_MAX_IMAGE_BYTES = 350 * 1024;

export type { ParsedClassroomSlide, ParsedSlideImage } from "@/lib/ppt-ingest-core";
export {
  MAX_FILE_BYTES,
  MAX_SLIDES,
} from "@/lib/ppt-ingest-core";

export function parsePptx(buffer: Uint8Array): ParsedClassroomSlide[] {
  return parsePptxBuffer(buffer, { maxImageBytes: SERVER_MAX_IMAGE_BYTES });
}

export function slidesForClassroomPlan(
  parsedSlides: ParsedClassroomSlide[],
  courseSlug: string,
  options?: { chapterPosition?: number },
): ClassroomSlide[] {
  const chapterPosition = options?.chapterPosition ?? 1;
  return parsedSlides.map((slide, index) => ({
    index,
    title: slide.title,
    bodyText: slide.bodyText,
    speakerNotes: slide.speakerNotes,
    bullets: slide.bullets,
    imageUrl:
      chapterPosition <= 1
        ? `/api/classroom/${courseSlug}/slides/${index}`
        : `/api/classroom/${courseSlug}/chapters/${chapterPosition}/slides/${index}`,
    layout: "blueprint" as const,
  }));
}

export async function parsedSlidesFromUploadFormAsync(
  form: FormData,
  options?: { chapterIndex?: number },
): Promise<ParsedClassroomSlide[]> {
  const chapterIndex = options?.chapterIndex ?? 0;
  const raw = String(form.get(chapterIndex === 0 ? "slides" : `slides-${chapterIndex}`) || "");
  if (!raw) {
    throw new Error("Prepared slide data is required.");
  }

  const metadata = JSON.parse(raw) as Array<{
    index: number;
    title: string;
    bodyText: string;
    speakerNotes: string;
    bullets?: string[];
    hasImage: boolean;
    imageCount?: number;
  }>;

  const slides: ParsedClassroomSlide[] = [];
  for (const slide of metadata) {
    const images: ParsedClassroomSlide["images"] = [];
    const imageCount = slide.imageCount || (slide.hasImage ? 1 : 0);
    const prefix =
      chapterIndex === 0
        ? `slide-image-${slide.index}`
        : `chapter-${chapterIndex}-slide-image-${slide.index}`;
    for (let imageIndex = 0; imageIndex < imageCount; imageIndex += 1) {
      const file = form.get(`${prefix}-${imageIndex}`);
      if (file instanceof File && file.size > 0) {
        images.push({
          bytes: new Uint8Array(await file.arrayBuffer()),
          mimeType: file.type || "image/jpeg",
        });
      }
    }
    if (!images.length && slide.hasImage) {
      const file = form.get(prefix);
      if (file instanceof File && file.size > 0) {
        images.push({
          bytes: new Uint8Array(await file.arrayBuffer()),
          mimeType: file.type || "image/jpeg",
        });
      }
    }
    slides.push({
      index: slide.index,
      title: slide.title,
      bodyText: slide.bodyText,
      speakerNotes: slide.speakerNotes,
      bullets: slide.bullets || [],
      image: images[0] || null,
      images,
    });
  }

  return slides;
}

export async function parsedChaptersFromUploadFormAsync(form: FormData) {
  const chaptersRaw = String(form.get("chapters") || "");
  if (!chaptersRaw) {
    const slides = await parsedSlidesFromUploadFormAsync(form);
    return [{ title: String(form.get("chapterTitle") || "Chapter 1"), slides }];
  }

  const chapters = JSON.parse(chaptersRaw) as Array<{ title: string }>;
  const parsed = [];
  for (let index = 0; index < chapters.length; index += 1) {
    parsed.push({
      title: chapters[index].title || `Chapter ${index + 1}`,
      slides: await parsedSlidesFromUploadFormAsync(form, { chapterIndex: index }),
    });
  }
  return parsed;
}
