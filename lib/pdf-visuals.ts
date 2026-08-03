import { createCanvas, type Canvas } from "@napi-rs/canvas";
import type { LessonPlan } from "@/lib/mason";
import { attachFrameImages } from "@/lib/visual-frame-crop";

const TARGET_WIDTH = 1600;

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
        return attachFrameImages(
          moment,
          pageCanvas,
          `${moment.title}, source PDF page ${pageNumber}`,
        );
      }),
    };
  } catch (error) {
    console.error("PDF visual extraction failed:", error);
    throw new Error(
      "The lesson was generated, but PDF pictures could not be extracted for the visual flipbooks. Try uploading the PDF again.",
    );
  }
}
