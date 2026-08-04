import { unzipSync } from "fflate";
import { MAX_SLIDES, mimeForPath, type ParsedSlideImage } from "@/lib/ppt-ingest-core";

export const MAX_SLIDE_IMAGE_ZIP_BYTES = 75 * 1024 * 1024;
const MAX_EXTRACTED_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_TOTAL_EXTRACTED_BYTES = 180 * 1024 * 1024;
const SUPPORTED_IMAGE_PATH = /\.(png|jpe?g|webp)$/i;

function baseName(path: string) {
  return path.split(/[\\/]/).pop() || path;
}

function imageNumber(path: string) {
  const name = baseName(path).replace(/\.[^.]+$/, "");
  const explicit = name.match(/(?:slide|page)\s*[-_ ]*(\d+)$/i);
  if (explicit) return Number(explicit[1]);
  const trailing = name.match(/(\d+)$/);
  return trailing ? Number(trailing[1]) : null;
}

export function extractSlideImagesFromZip(
  zipBytes: Uint8Array,
  expectedSlideCount: number,
): ParsedSlideImage[] {
  if (expectedSlideCount < 1 || expectedSlideCount > MAX_SLIDES) {
    throw new Error(`The PowerPoint must contain between 1 and ${MAX_SLIDES} slides.`);
  }

  let unpacked: Record<string, Uint8Array>;
  try {
    unpacked = unzipSync(zipBytes);
  } catch {
    throw new Error("The slide-image ZIP could not be opened.");
  }

  const entries = Object.entries(unpacked).filter(([path, bytes]) => {
    const name = baseName(path);
    return bytes.byteLength > 0 && SUPPORTED_IMAGE_PATH.test(path) &&
      !path.includes("__MACOSX") && !name.startsWith(".");
  });

  if (entries.length !== expectedSlideCount) {
    throw new Error(
      `The ZIP contains ${entries.length} slide images, but the PowerPoint contains ${expectedSlideCount} slides. Export and ZIP all slides together.`,
    );
  }

  let totalBytes = 0;
  for (const [path, bytes] of entries) {
    if (bytes.byteLength > MAX_EXTRACTED_IMAGE_BYTES) {
      throw new Error(`${baseName(path)} is larger than 12 MB.`);
    }
    totalBytes += bytes.byteLength;
  }
  if (totalBytes > MAX_TOTAL_EXTRACTED_BYTES) {
    throw new Error("The extracted slide images are too large. Export them at a lower resolution.");
  }

  const numbered = new Map<number, [string, Uint8Array]>();
  let numberedEntryCount = 0;
  for (const entry of entries) {
    const number = imageNumber(entry[0]);
    if (number === null) continue;
    numberedEntryCount += 1;
    if (numbered.has(number)) {
      throw new Error(`More than one image is numbered as slide ${number}.`);
    }
    numbered.set(number, entry);
  }

  const numberedOrder = Array.from(
    { length: expectedSlideCount },
    (_, index) => numbered.get(index + 1),
  );
  const matchedByNumber = numberedOrder.every(
    (entry): entry is [string, Uint8Array] => Boolean(entry),
  );
  if (numberedEntryCount > 0 && !matchedByNumber) {
    throw new Error("Slide image numbers must run from 1 through the final PowerPoint slide.");
  }
  const ordered = matchedByNumber
    ? numberedOrder
    : entries.sort(([left], [right]) =>
        left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" }),
      );

  return ordered.map(([path, bytes]) => ({ bytes, mimeType: mimeForPath(path) }));
}

/** Extract slide images from a ZIP in filename order (no PPTX slide count required). */
export function extractImagesFromZip(zipBytes: Uint8Array): ParsedSlideImage[] {
  let unpacked: Record<string, Uint8Array>;
  try {
    unpacked = unzipSync(zipBytes);
  } catch {
    throw new Error("The slide-image ZIP could not be opened.");
  }

  const entries = Object.entries(unpacked).filter(([path, bytes]) => {
    const name = baseName(path);
    return (
      bytes.byteLength > 0 &&
      SUPPORTED_IMAGE_PATH.test(path) &&
      !path.includes("__MACOSX") &&
      !name.startsWith(".")
    );
  });

  if (!entries.length) {
    throw new Error("No PNG, JPEG, or WebP images were found in the ZIP.");
  }

  if (entries.length > MAX_SLIDES) {
    throw new Error(`A course can have at most ${MAX_SLIDES} content slides.`);
  }

  let totalBytes = 0;
  for (const [path, bytes] of entries) {
    if (bytes.byteLength > MAX_EXTRACTED_IMAGE_BYTES) {
      throw new Error(`${baseName(path)} is larger than 12 MB.`);
    }
    totalBytes += bytes.byteLength;
  }
  if (totalBytes > MAX_TOTAL_EXTRACTED_BYTES) {
    throw new Error("The extracted slide images are too large. Export them at a lower resolution.");
  }

  const numbered = new Map<number, [string, Uint8Array]>();
  let numberedEntryCount = 0;
  for (const entry of entries) {
    const number = imageNumber(entry[0]);
    if (number === null) continue;
    numberedEntryCount += 1;
    if (numbered.has(number)) {
      throw new Error(`More than one image is numbered as slide ${number}.`);
    }
    numbered.set(number, entry);
  }

  if (numberedEntryCount === entries.length && numbered.size === entries.length) {
    const ordered = Array.from({ length: entries.length }, (_, index) => numbered.get(index + 1));
    if (ordered.every((entry): entry is [string, Uint8Array] => Boolean(entry))) {
      return ordered.map(([path, bytes]) => ({ bytes, mimeType: mimeForPath(path) }));
    }
  }

  return entries
    .sort(([left], [right]) =>
      left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" }),
    )
    .map(([path, bytes]) => ({ bytes, mimeType: mimeForPath(path) }));
}

export async function validateSlideImageZip(file: File, expectedSlideCount: number) {
  if (!/\.zip$/i.test(file.name)) throw new Error("Choose a .zip file containing slide images.");
  if (file.size > MAX_SLIDE_IMAGE_ZIP_BYTES) {
    throw new Error("Slide-image ZIP files are limited to 75 MB.");
  }
  return extractSlideImagesFromZip(new Uint8Array(await file.arrayBuffer()), expectedSlideCount);
}
