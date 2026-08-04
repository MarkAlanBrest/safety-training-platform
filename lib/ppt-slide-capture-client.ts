"use client";

import type { ParsedSlideImage } from "@/lib/ppt-ingest-core";

/** Target print-like clarity without blowing upload budgets. */
const RENDER_DPI_ATTEMPTS = [220, 200, 175, 150] as const;
const MAX_BYTES_PER_SLIDE = 900 * 1024;

type PptxRendererLike = {
  slideSize: { cx: number; cy: number };
  slideCount: number;
  load: (
    source: File | Blob | ArrayBuffer | Uint8Array,
    onProgress?: (progress: number, message: string) => void,
  ) => Promise<void>;
  renderSlide: (index: number, canvas: HTMLCanvasElement, width?: number) => Promise<void>;
  destroy: () => void;
};

function slideRenderWidth(renderer: PptxRendererLike, dpi: number) {
  const inches = renderer.slideSize.cx / 914400;
  return Math.max(1280, Math.round(inches * dpi));
}

async function waitForStableRender() {
  if (typeof document !== "undefined" && "fonts" in document) {
    try {
      await document.fonts.ready;
    } catch {
      // Ignore font readiness failures.
    }
  }
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

async function canvasToSlideImage(
  canvas: HTMLCanvasElement,
  maxBytes: number,
): Promise<ParsedSlideImage | null> {
  const attempts: Array<{ type: string; quality?: number }> = [
    { type: "image/png" },
    { type: "image/webp", quality: 0.92 },
    { type: "image/jpeg", quality: 0.94 },
    { type: "image/jpeg", quality: 0.88 },
    { type: "image/jpeg", quality: 0.8 },
  ];

  for (const attempt of attempts) {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, attempt.type, attempt.quality),
    );
    if (!blob) continue;
    if (blob.size <= maxBytes) {
      return {
        bytes: new Uint8Array(await blob.arrayBuffer()),
        mimeType: blob.type || attempt.type,
      };
    }
  }

  return null;
}

/**
 * Render each PowerPoint slide to a high-resolution image that matches the deck.
 */
export async function captureSlidesFromPptx(
  source: File | Blob | ArrayBuffer | Uint8Array,
  expectedSlideCount: number,
  onProgress?: (current: number, total: number) => void,
): Promise<Array<ParsedSlideImage | null>> {
  if (typeof document === "undefined") return [];

  try {
    const { default: PptxRenderer } = await import("pptx-browser");
    const renderer = new PptxRenderer() as unknown as PptxRendererLike;
    try {
      await renderer.load(source);
      const total = Math.min(renderer.slideCount, expectedSlideCount);
      const captured: Array<ParsedSlideImage | null> = Array.from({ length: total }, () => null);

      for (let index = 0; index < total; index += 1) {
        onProgress?.(index + 1, total);
        let image: ParsedSlideImage | null = null;

        for (const dpi of RENDER_DPI_ATTEMPTS) {
          const canvas = document.createElement("canvas");
          const width = slideRenderWidth(renderer, dpi);
          await renderer.renderSlide(index, canvas, width);
          await waitForStableRender();
          image = await canvasToSlideImage(canvas, MAX_BYTES_PER_SLIDE);
          if (image) break;
        }

        captured[index] = image;
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
