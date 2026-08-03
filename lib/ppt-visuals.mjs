import { createCanvas, loadImage } from "@napi-rs/canvas";
import { parsePptxBuffer } from "./ppt-ingest-core.ts";
import { attachFrameImages } from "./visual-frame-crop.ts";

const MIN_IMAGE_BYTES = 8 * 1024;

function slidePageNumber(index) {
  return index + 1;
}

function isTeachableSlideImage(image) {
  if (!image) return false;
  if (image.mimeType === "image/svg+xml") return true;
  return image.bytes.byteLength >= MIN_IMAGE_BYTES;
}

async function loadSlideCanvas(image) {
  try {
    const img = await loadImage(Buffer.from(image.bytes));
    const canvas = createCanvas(img.width, img.height);
    const context = canvas.getContext("2d");
    context.drawImage(img, 0, 0);
    return canvas;
  } catch (error) {
    console.warn("Could not decode slide image:", error);
    return null;
  }
}

function imageSlideNumbers(slides) {
  return slides
    .filter((slide) => isTeachableSlideImage(slide.image))
    .map((slide) => slidePageNumber(slide.index));
}

function assignVisualSlideNumbers(lessonPlan, availableSlides) {
  let nextSlide = 0;

  return {
    ...lessonPlan,
    moments: lessonPlan.moments.map((moment) => {
      if (moment.kind !== "visual") return moment;
      if (Number.isInteger(moment.pageNumber) && Number(moment.pageNumber) > 0) {
        return moment;
      }

      const pageNumber = availableSlides[nextSlide];
      if (!pageNumber) return moment;
      nextSlide += 1;
      return { ...moment, pageNumber };
    }),
  };
}

/**
 * Extract slide pictures from a PowerPoint deck and attach zoomed flipbook
 * crops to visual lesson moments. Falls back silently for slides without a
 * usable embedded image.
 */
export async function attachPptxVisuals(pptx, lessonPlan) {
  const slides = parsePptxBuffer(
    pptx instanceof Buffer ? new Uint8Array(pptx) : pptx,
  );
  const teachableSlides = imageSlideNumbers(slides);
  if (!teachableSlides.length) return lessonPlan;

  const plannedLesson = assignVisualSlideNumbers(lessonPlan, teachableSlides);
  const visualMoments = plannedLesson.moments.filter(
    (moment) =>
      moment.kind === "visual" &&
      Number.isInteger(moment.pageNumber) &&
      Number(moment.pageNumber) > 0,
  );
  if (!visualMoments.length) return lessonPlan;

  const slideCanvases = new Map();
  await Promise.all(
    slides.map(async (slide) => {
      if (!isTeachableSlideImage(slide.image)) return;
      const canvas = await loadSlideCanvas(slide.image);
      if (!canvas) return;
      slideCanvases.set(slidePageNumber(slide.index), canvas);
    }),
  );

  if (!slideCanvases.size) return lessonPlan;

  return {
    ...plannedLesson,
    moments: plannedLesson.moments.map((moment) => {
      const pageNumber = Number(moment.pageNumber);
      const slideCanvas = slideCanvases.get(pageNumber);
      if (moment.kind !== "visual" || !slideCanvas) return moment;
      return attachFrameImages(
        moment,
        slideCanvas,
        `${moment.title}, source slide ${pageNumber}`,
      );
    }),
  };
}
