import { createCanvas, loadImage } from "@napi-rs/canvas";
import type { ParsedClassroomSlide } from "@/lib/ppt-ingest-core";

const SLIDE_WIDTH = 960;
const SLIDE_HEIGHT = 540;
const MIN_FULL_SLIDE_BYTES = 12 * 1024;

function wrapText(
  context: ReturnType<ReturnType<typeof createCanvas>["getContext"]>,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(/\s+/).filter(Boolean);
  let line = "";
  let cursorY = y;
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (context.measureText(next).width > maxWidth && line) {
      context.fillText(line, x, cursorY);
      line = word;
      cursorY += lineHeight;
    } else {
      line = next;
    }
    if (cursorY > SLIDE_HEIGHT - 40) return;
  }
  if (line) context.fillText(line, x, cursorY);
}

function drawContainedImage(
  context: ReturnType<ReturnType<typeof createCanvas>["getContext"]>,
  image: { width: number; height: number },
  draw: (dx: number, dy: number, dw: number, dh: number) => void,
) {
  const scale = Math.min(SLIDE_WIDTH / image.width, SLIDE_HEIGHT / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  const x = (SLIDE_WIDTH - width) / 2;
  const y = (SLIDE_HEIGHT - height) / 2;
  draw(x, y, width, height);
}

export async function renderSlideAsset(
  slide: ParsedClassroomSlide,
): Promise<{ bytes: Uint8Array; mimeType: string }> {
  if (slide.renderedSlide?.bytes.byteLength) {
    return {
      bytes: slide.renderedSlide.bytes,
      mimeType: slide.renderedSlide.mimeType,
    };
  }

  const primary = slide.image;
  if (primary && primary.bytes.byteLength >= MIN_FULL_SLIDE_BYTES) {
    return { bytes: primary.bytes, mimeType: primary.mimeType };
  }

  const canvas = createCanvas(SLIDE_WIDTH, SLIDE_HEIGHT);
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, SLIDE_WIDTH, SLIDE_HEIGHT);

  let drewImage = false;
  for (const image of slide.images) {
    try {
      const bitmap = await loadImage(Buffer.from(image.bytes));
      drawContainedImage(context, bitmap, (x, y, width, height) => {
        context.drawImage(bitmap, x, y, width, height);
        drewImage = true;
      });
    } catch {
      // Skip undecodable images and continue with text fallback.
    }
  }

  if (!drewImage || slide.bullets.length || slide.bodyText) {
    context.fillStyle = "#0f172a";
    context.font = "bold 34px Arial";
    context.fillText(slide.title.slice(0, 90), 56, 80, SLIDE_WIDTH - 112);

    context.font = "22px Arial";
    context.fillStyle = "#334155";
    const lines = [
      ...slide.bullets,
      ...slide.bodyText
        .split(/(?<=[.!?])\s+/)
        .map((part) => part.trim())
        .filter((part) => part.length > 8),
    ].filter(Boolean);
    let y = 132;
    for (const line of lines.slice(0, 10)) {
      wrapText(context, line, 56, y, SLIDE_WIDTH - 112, 30);
      y += 38;
      if (y > SLIDE_HEIGHT - 56) break;
    }
  }

  return {
    bytes: new Uint8Array(canvas.toBuffer("image/jpeg", 90)),
    mimeType: "image/jpeg",
  };
}
