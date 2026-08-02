import { createCanvas } from "@napi-rs/canvas";
import type { LessonPlan } from "@/lib/mason";

const TARGET_WIDTH = 1600;
const JPEG_QUALITY = 85;

/**
 * Render the PDF pages cited by visual lesson moments and persist the optimized
 * pictures inside the lesson JSON. Uploaded PDFs are intentionally temporary,
 * while lesson JSON is stored in PostgreSQL, so data URLs keep the visuals
 * available in both local and deployed players without requiring disk storage.
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
    const renderedPages = new Map<number, string>();

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

        const encoded = canvas.toBuffer("image/jpeg", JPEG_QUALITY);
        renderedPages.set(
          pageNumber,
          `data:image/jpeg;base64,${encoded.toString("base64")}`,
        );
        page.cleanup();
      }),
    );

    await loadingTask.destroy();

    return {
      ...lessonPlan,
      moments: lessonPlan.moments.map((moment) => {
        const pageNumber = Number(moment.pageNumber);
        const sourceImage = renderedPages.get(pageNumber);
        if (moment.kind !== "visual" || !sourceImage) return moment;

        return {
          ...moment,
          sourceImage,
          sourceImageAlt: `${moment.title}, source PDF page ${pageNumber}`,
        };
      }),
    };
  } catch (error) {
    console.error("PDF visual extraction failed:", error);
    throw new Error(
      "The lesson was generated, but PDF pictures could not be extracted for the visual flipbooks. Try uploading the PDF again.",
    );
  }
}
