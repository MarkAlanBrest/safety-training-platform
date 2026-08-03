import { createCanvas, type Canvas } from "@napi-rs/canvas";
import type { LessonMoment } from "@/lib/mason";

const JPEG_QUALITY = 85;
const FRAME_ASPECT = 16 / 9;

export type FrameFocus = {
  x: number;
  y: number;
  scale: number;
};

export function frameFocus(
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

export function cropFrameImage(pageCanvas: Canvas, focus: FrameFocus): string {
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

export function attachFrameImages(
  moment: LessonMoment,
  pageCanvas: Canvas,
  sourceLabel: string,
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
    sourceImageAlt: moment.sourceImageAlt || sourceLabel,
  };
}
