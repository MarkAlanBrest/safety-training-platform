import type { ClassroomSlide } from "@/lib/classroom";
import {
  type ParsedClassroomSlide,
  placeholderSlideDataUrl,
  parsePptxBuffer,
} from "@/lib/ppt-ingest-core";

const SERVER_MAX_IMAGE_BYTES = 350 * 1024;

export type { ParsedClassroomSlide, ParsedSlideImage } from "@/lib/ppt-ingest-core";
export {
  MAX_FILE_BYTES,
  MAX_SLIDES,
  placeholderSlideDataUrl,
} from "@/lib/ppt-ingest-core";

export function parsePptx(buffer: Uint8Array): ParsedClassroomSlide[] {
  return parsePptxBuffer(buffer, { maxImageBytes: SERVER_MAX_IMAGE_BYTES });
}

export function slidesForClassroomPlan(
  parsedSlides: ParsedClassroomSlide[],
  courseSlug: string,
): ClassroomSlide[] {
  return parsedSlides.map((slide) => ({
    index: slide.index,
    title: slide.title,
    bodyText: slide.bodyText,
    speakerNotes: slide.speakerNotes,
    imageUrl: slide.image ? `/api/classroom/${courseSlug}/slides/${slide.index}` : undefined,
    imageDataUrl: slide.image
      ? undefined
      : placeholderSlideDataUrl(
          slide.title.slice(0, 72),
          slide.bodyText.slice(0, 220) || "Imported from PowerPoint",
          slide.index,
        ),
  }));
}
