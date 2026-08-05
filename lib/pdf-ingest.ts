import type { ParsedClassroomSlide } from "@/lib/ppt-ingest-core";

export const MAX_PDF_BYTES = 25 * 1024 * 1024;
export const MAX_PDF_PAGES = 60;

function cleanLine(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function titleFromPageText(pageText: string, pageNumber: number): string {
  const lines = pageText.split("\n").map(cleanLine).filter(Boolean);
  const firstShortLine = lines.find((line) => line.length > 0 && line.length <= 80);
  return firstShortLine || `Page ${pageNumber}`;
}

function bulletsFromPageText(pageText: string): string[] {
  const lines = pageText.split("\n").map(cleanLine).filter(Boolean);
  const marked = lines
    .filter((line) => /^[•●▪◦·*-]\s*/.test(line))
    .map((line) => line.replace(/^[•●▪◦·*-]\s*/, "").trim())
    .filter(Boolean);
  if (marked.length) return marked;

  return lines.filter((line) => line.length > 4 && line.length <= 120).slice(0, 8);
}

/**
 * Extracts text-only "slides" from a PDF, one per page. Per the project's
 * notes-only-upload convention, this never rasterizes pages to images — only
 * directly-uploaded images are ever shown on screen. `image`/`images` are
 * always empty so a PDF-derived ParsedClassroomSlide behaves like a pptx
 * slide that has text but no picture.
 */
export async function parsePdfBuffer(
  buffer: Buffer | Uint8Array,
  options?: { maxPages?: number },
): Promise<ParsedClassroomSlide[]> {
  if (buffer.byteLength > MAX_PDF_BYTES) {
    throw new Error("PDF files are limited to 25 MB.");
  }

  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = getDocument({ data: new Uint8Array(buffer) });
  const document = await task.promise;
  const maxPages = Math.min(options?.maxPages || MAX_PDF_PAGES, MAX_PDF_PAGES);

  if (document.numPages > maxPages) {
    await task.destroy();
    throw new Error(`PDF files are limited to ${maxPages} pages.`);
  }

  const slides: ParsedClassroomSlide[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const lines: string[] = [];
      let current = "";

      for (const item of content.items) {
        if (!("str" in item)) continue;
        const value = item.str.trim();
        if (value) current += `${current ? " " : ""}${value}`;
        if ("hasEOL" in item && item.hasEOL && current) {
          lines.push(current);
          current = "";
        }
      }
      if (current) lines.push(current);

      const pageText = lines.join("\n");
      page.cleanup();

      slides.push({
        index: pageNumber - 1,
        title: titleFromPageText(pageText, pageNumber),
        bodyText: pageText,
        speakerNotes: "",
        bullets: bulletsFromPageText(pageText),
        image: null,
        images: [],
        renderedSlide: null,
      });
    }
  } finally {
    await task.destroy();
  }

  const nonEmpty = slides.filter((slide) => slide.bodyText.trim().length > 0);
  if (!nonEmpty.length) {
    throw new Error("No readable text was found in this PDF.");
  }

  return nonEmpty.map((slide, index) => ({ ...slide, index }));
}
