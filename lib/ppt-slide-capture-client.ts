"use client";

import type { ParsedSlideImage } from "@/lib/ppt-ingest-core";

const RENDER_WIDTH = 1280;
const JPEG_QUALITY = 0.88;

async function canvasToJpeg(canvas: HTMLCanvasElement): Promise<ParsedSlideImage | null> {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
  );
  if (!blob) return null;
  return {
    bytes: new Uint8Array(await blob.arrayBuffer()),
    mimeType: "image/jpeg",
  };
}

/**
 * Render each PowerPoint slide to a JPEG that matches the uploaded deck.
 * Falls back to an empty array when rendering is unavailable.
 */
export async function captureSlidesFromPptx(
  source: File | Blob | ArrayBuffer | Uint8Array,
  expectedSlideCount: number,
  onProgress?: (current: number, total: number) => void,
): Promise<Array<ParsedSlideImage | null>> {
  if (typeof document === "undefined") return [];

  try {
    const { default: PptxRenderer } = await import("pptx-browser");
    const renderer = new PptxRenderer();
    try {
      await renderer.load(source);
      const total = Math.min(renderer.slideCount, expectedSlideCount);
      const captured: Array<ParsedSlideImage | null> = Array.from({ length: total }, () => null);

      for (let index = 0; index < total; index += 1) {
        onProgress?.(index + 1, total);
        const canvas = document.createElement("canvas");
        await renderer.renderSlide(index, canvas, RENDER_WIDTH);
        const image = await canvasToJpeg(canvas);
        if (image) captured[index] = image;
      }

      return captured;
    } finally {
      renderer.destroy();
    }
  } catch (error) {
    console.warn("PPT slide capture failed, using embedded images:", error);
    return [];
  }
}
