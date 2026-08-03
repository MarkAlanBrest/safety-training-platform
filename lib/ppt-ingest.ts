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
          "Imported from PowerPoint",
          slide.index,
        ),
  }));
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
      image,
    });
  }

  return slides;
}
