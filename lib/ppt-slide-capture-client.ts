"use client";

import type { ParsedSlideImage } from "@/lib/ppt-ingest-core";

const RENDER_WIDTH = 1920;
const MAX_BYTES_PER_SLIDE = 2.5 * 1024 * 1024;

type PptxRendererLike = {
  slideSize: { cx: number; cy: number };
  slideCount: number;
  load: (
    source: File | Blob | ArrayBuffer | Uint8Array,
    onProgress?: (progress: number, message: string) => void,
  ) => Promise<void>;
  loadEmbeddedFonts?: () => Promise<unknown>;
  renderSlide: (index: number, canvas: HTMLCanvasElement, width?: number) => Promise<void>;
  destroy: () => void;
};

function slideHeight(renderer: PptxRendererLike, width: number) {
  const aspect = renderer.slideSize.cx / renderer.slideSize.cy;
  return Math.max(1, Math.round(width / aspect));
}

function createRenderHost() {
  const host = document.createElement("div");
  host.setAttribute("data-pptx-render-host", "true");
  host.style.cssText =
    "position:fixed;left:-10000px;top:0;width:1px;height:1px;overflow:hidden;pointer-events:none;opacity:0;";
  document.body.appendChild(host);
  return host;
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

function canvasHasVisibleContent(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d");
  if (!context || canvas.width < 1 || canvas.height < 1) return false;

  const sampleWidth = Math.min(96, canvas.width);
  const sampleHeight = Math.min(96, canvas.height);
  const { data } = context.getImageData(0, 0, sampleWidth, sampleHeight);

  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3];
    if (alpha === 0) continue;
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    if (red < 248 || green < 248 || blue < 248) return true;
  }

  return false;
}

async function canvasToSlideImage(canvas: HTMLCanvasElement): Promise<ParsedSlideImage | null> {
  const attempts: Array<{ type: string; quality?: number }> = [
    { type: "image/png" },
    { type: "image/webp", quality: 0.94 },
    { type: "image/jpeg", quality: 0.94 },
    { type: "image/jpeg", quality: 0.88 },
    { type: "image/jpeg", quality: 0.8 },
  ];

  let largest: ParsedSlideImage | null = null;

  for (const attempt of attempts) {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, attempt.type, attempt.quality),
    );
    if (!blob) continue;

    const image = {
      bytes: new Uint8Array(await blob.arrayBuffer()),
      mimeType: blob.type || attempt.type,
    };

    if (!largest || image.bytes.byteLength > largest.bytes.byteLength) {
      largest = image;
    }

    if (blob.size <= MAX_BYTES_PER_SLIDE) {
      return image;
    }
  }

  return largest;
}

async function renderSlideToImage(
  renderer: PptxRendererLike,
  host: HTMLElement,
  index: number,
): Promise<ParsedSlideImage> {
  const canvas = document.createElement("canvas");
  const width = RENDER_WIDTH;
  const height = slideHeight(renderer, width);
  canvas.width = width;
  canvas.height = height;
  host.appendChild(canvas);

  try {
    await renderer.renderSlide(index, canvas, width);
    await waitForStableRender();

    if (!canvasHasVisibleContent(canvas)) {
      throw new Error(`Slide ${index + 1} rendered blank.`);
    }

    const image = await canvasToSlideImage(canvas);
    if (!image?.bytes.byteLength) {
      throw new Error(`Slide ${index + 1} could not be saved as an image.`);
    }

    return image;
  } finally {
    canvas.remove();
  }
}

/**
 * Render each PowerPoint slide to a high-resolution image that matches the deck.
 */
export async function captureSlidesFromPptx(
  source: File | Blob | ArrayBuffer | Uint8Array,
  expectedSlideCount: number,
  onProgress?: (current: number, total: number) => void,
): Promise<ParsedSlideImage[]> {
  if (typeof document === "undefined") {
    throw new Error("Slide conversion must run in the browser.");
  }

  const host = createRenderHost();

  try {
    const { default: PptxRenderer } = await import("pptx-browser");
    const renderer = new PptxRenderer() as unknown as PptxRendererLike;

    try {
      await renderer.load(source);
      if (renderer.loadEmbeddedFonts) {
        await renderer.loadEmbeddedFonts();
      }

      const total = Math.min(renderer.slideCount, expectedSlideCount);
      if (!total) {
        throw new Error("No slides were found in this PowerPoint file.");
      }

      const captured: ParsedSlideImage[] = [];
      const failures: number[] = [];

      for (let index = 0; index < total; index += 1) {
        onProgress?.(index + 1, total);
        try {
          captured[index] = await renderSlideToImage(renderer, host, index);
        } catch (error) {
          console.warn(`Slide ${index + 1} capture failed:`, error);
          failures.push(index + 1);
        }
      }

      if (failures.length === total) {
        throw new Error(
          "PowerPoint could not be converted to slide pictures in this browser. Export your slides as PNG or JPEG from PowerPoint, ZIP them, and import that ZIP instead.",
        );
      }

      if (failures.length) {
        throw new Error(
          `Could not convert slide${failures.length === 1 ? "" : "s"} ${failures.join(", ")} to pictures. Export those slides from PowerPoint as images, or export the whole deck as a ZIP.`,
        );
      }

      return captured;
    } finally {
      renderer.destroy();
    }
  } finally {
    host.remove();
  }
}
