import type { ClassroomSlide } from "@/lib/classroom";
import { structureClassroomSlide } from "@/lib/classroom-slide-content";
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
): ClassroomSlide[] {
  return parsedSlides.map((slide) => {
    const structured = structureClassroomSlide({
      index: slide.index,
      title: slide.title,
      bodyText: slide.bodyText,
      speakerNotes: slide.speakerNotes,
      bullets: slide.bullets,
      imageUrl: slide.image ? `/api/classroom/${courseSlug}/slides/${slide.index}` : undefined,
    });
    return {
      index: structured.index,
      title: structured.title,
      bodyText: structured.bodyText,
      speakerNotes: structured.speakerNotes,
      subtitle: structured.subtitle,
      bullets: structured.bullets,
      highlight: structured.highlight,
      layout: structured.layout,
      imageUrl: structured.imageUrl,
    };
  });
}

export async function parsedSlidesFromUploadFormAsync(
  form: FormData,
): Promise<ParsedClassroomSlide[]> {
  const raw = String(form.get("slides") || "");
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
  }>;

  const slides: ParsedClassroomSlide[] = [];
  for (const slide of metadata) {
    let image: ParsedClassroomSlide["image"] = null;
    if (slide.hasImage) {
      const file = form.get(`slide-image-${slide.index}`);
      if (file instanceof File && file.size > 0) {
        image = {
          bytes: new Uint8Array(await file.arrayBuffer()),
          mimeType: file.type || "image/jpeg",
        };
      }
    }
    slides.push({
      index: slide.index,
      title: slide.title,
      bodyText: slide.bodyText,
      speakerNotes: slide.speakerNotes,
      bullets: slide.bullets || [],
      image,
    });
  }

  return slides;
}
