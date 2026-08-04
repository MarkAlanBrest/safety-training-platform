import { openPresentation } from "node-pptx-png";
import type { SizePreset } from "node-pptx-png";
import { MAX_FILE_BYTES, MAX_SLIDES, parsePptxBuffer } from "@/lib/ppt-ingest-core";

export type RenderedPptxSlide = {
  index: number;
  bytes: Uint8Array;
  mimeType: string;
};

function assertPptxBytes(buffer: Uint8Array) {
  if (buffer.byteLength > MAX_FILE_BYTES) {
    throw new Error("PowerPoint files are limited to 25 MB.");
  }
  const slideCount = parsePptxBuffer(buffer).length;
  if (slideCount > MAX_SLIDES) {
    throw new Error(`PowerPoint files are limited to ${MAX_SLIDES} slides.`);
  }
  return slideCount;
}

/**
 * Render every slide in a PPTX to images using the native Node renderer (Skia).
 * Much higher fidelity than browser-side conversion.
 */
export async function renderPptxSlides(
  buffer: Uint8Array,
  options?: { preset?: SizePreset; format?: "png" | "jpeg" | "webp" },
): Promise<RenderedPptxSlide[]> {
  const slideCount = assertPptxBytes(buffer);
  const preset = options?.preset ?? "hd";
  const format = options?.format ?? "png";

  const doc = await openPresentation(Buffer.from(buffer), { logLevel: "warn" });
  const rendered: RenderedPptxSlide[] = [];
  const failures: number[] = [];

  try {
    for await (const slide of doc.slides({
      preset,
      format,
      jpegQuality: format === "jpeg" ? 90 : undefined,
      pngOptimization: format === "png" ? "web" : undefined,
    })) {
      if (!slide.success || !slide.imageData?.byteLength) {
        failures.push(slide.slideNumber);
        continue;
      }

      rendered.push({
        index: slide.slideIndex,
        bytes: new Uint8Array(slide.imageData),
        mimeType:
          format === "jpeg"
            ? "image/jpeg"
            : format === "webp"
              ? "image/webp"
              : "image/png",
      });
    }
  } finally {
    doc.close();
  }

  if (failures.length) {
    throw new Error(
      `Could not render slide${failures.length === 1 ? "" : "s"} ${failures.join(", ")} from the PowerPoint.`,
    );
  }

  if (rendered.length !== slideCount) {
    throw new Error(
      `Expected ${slideCount} rendered slides but received ${rendered.length}.`,
    );
  }

  return rendered;
}
