import { createCanvas, type Canvas } from "@napi-rs/canvas";
import type { LessonMoment, LessonPlan } from "@/lib/mason";

const TARGET_WIDTH = 1600;
const JPEG_QUALITY = 85;
const FRAME_ASPECT = 16 / 9;

type FrameFocus = {
  x: number;
  y: number;
  scale: number;
};

function frameFocus(
  moment: LessonMoment,
  frame: NonNullable<LessonMoment["explainerFrames"]>[number],
  frameIndex: number,
  totalFrames: number,
): FrameFocus {
  if (
    typeof frame.focusX === "number" &&
    typeof frame.focusY === "number" &&
    typeof frame.focusScale === "number"
  ) {
    return {
      x: frame.focusX,
      y: frame.focusY,
      scale: frame.focusScale,
    };
  }

  const baseX = moment.focusX ?? 50;
  const baseY = moment.focusY ?? 50;
  const baseScale = moment.focusScale ?? 1.45;

  if (totalFrames <= 1) {
    return { x: baseX, y: baseY, scale: baseScale };
  }

  const columns = Math.min(3, totalFrames);
  const row = Math.floor(frameIndex / columns);
  const column = frameIndex % columns;
  const columnSpan = 70 / Math.max(1, columns - 1);

  return {
    x: Math.min(85, Math.max(15, 15 + column * columnSpan)),
    y: Math.min(80, Math.max(20, baseY - 12 + row * 22)),
    scale: Math.min(2.4, baseScale + frameIndex * 0.18),
  };
}

function cropFrameImage(
  pageCanvas: Canvas,
  focus: FrameFocus,
): string {
  const width = pageCanvas.width;
  const height = pageCanvas.height;
  const cx = (focus.x / 100) * width;
  const cy = (focus.y / 100) * height;
  const cropWidth = Math.min(width, width / focus.scale);
  const cropHeight = Math.min(height, cropWidth / FRAME_ASPECT);
  const sx = Math.round(
    Math.max(0, Math.min(width - cropWidth, cx - cropWidth / 2)),
  );
  const sy = Math.round(
    Math.max(0, Math.min(height - cropHeight, cy - cropHeight / 2)),
  );
  const outputWidth = Math.max(1, Math.round(cropWidth));
  const outputHeight = Math.max(1, Math.round(cropHeight));
  const output = createCanvas(outputWidth, outputHeight);
  const context = output.getContext("2d");

  context.drawImage(
    pageCanvas as unknown as Canvas,
    sx,
    sy,
    cropWidth,
    cropHeight,
    0,
    0,
    outputWidth,
    outputHeight,
  );

  return `data:image/jpeg;base64,${output.toBuffer("image/jpeg", JPEG_QUALITY).toString("base64")}`;
}

function attachFrameImages(
  moment: LessonMoment,
  pageCanvas: Canvas,
): LessonMoment {
  const frames = moment.explainerFrames || [];
  if (!frames.length) return moment;

  const nextFrames = frames.map((frame, index) => ({
    ...frame,
    sourceImage: cropFrameImage(
      pageCanvas,
      frameFocus(moment, frame, index, frames.length),
    ),
  }));

  return {
    ...moment,
    explainerFrames: nextFrames,
    sourceImage: nextFrames[0]?.sourceImage || moment.sourceImage,
    sourceImageAlt:
      moment.sourceImageAlt ||
      `${moment.title}, source PDF page ${moment.pageNumber}`,
  };
}

/**
 * Render the PDF pages cited by visual lesson moments and persist optimized
 * frame crops inside the lesson JSON so each flipbook step shows a different
 * zoomed region of the source page.
 */
export async function attachPdfVisuals(
  pdf: Buffer,
  lessonPlan: LessonPlan,
): Promise<LessonPlan> {
  const visualMoments = lessonPlan.moments.filter(
    (moment) =>
      moment.kind === "visual" &&
      Number.isInteger(moment.pageNumber) &&
      Number(moment.pageNumber) > 0,
  );

  if (!visualMoments.length) return lessonPlan;

  try {
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const loadingTask = getDocument({
      data: new Uint8Array(pdf),
    });
    const document = await loadingTask.promise;

    const pages = [
      ...new Set(
        visualMoments
          .map((moment) => Number(moment.pageNumber))
          .filter((pageNumber) => pageNumber <= document.numPages),
      ),
    ];
    const renderedPages = new Map<number, Canvas>();

    await Promise.all(
      pages.map(async (pageNumber) => {
        const page = await document.getPage(pageNumber);
        const originalViewport = page.getViewport({ scale: 1 });
        const scale = TARGET_WIDTH / originalViewport.width;
        const viewport = page.getViewport({ scale });
        const canvas = createCanvas(
          Math.ceil(viewport.width),
          Math.ceil(viewport.height),
        );

        await page.render({
          canvas: canvas as unknown as HTMLCanvasElement,
          viewport,
          background: "#ffffff",
        }).promise;

        renderedPages.set(pageNumber, canvas);
        page.cleanup();
      }),
    );

    await loadingTask.destroy();

    return {
      ...lessonPlan,
      moments: lessonPlan.moments.map((moment) => {
        const pageNumber = Number(moment.pageNumber);
        const pageCanvas = renderedPages.get(pageNumber);
        if (moment.kind !== "visual" || !pageCanvas) return moment;
        return attachFrameImages(moment, pageCanvas);
      }),
    };
  } catch (error) {
    console.error("PDF visual extraction failed:", error);
    throw new Error(
      "The lesson was generated, but PDF pictures could not be extracted for the visual flipbooks. Try uploading the PDF again.",
    );
  }
}
