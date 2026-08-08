export type ParsedSlideNarration = {
  slideNumber: number;
  text: string;
};

const SLIDE_HEADING_RE = /^\s*slide\s+(\d+)\s*:?\s*$/i;

/** Split a document into per-slide narration using `Slide 1`, `Slide 2`, ... headings. */
export function parseSlideNarrationDocument(raw: string): ParsedSlideNarration[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  const lines = trimmed.split(/\r?\n/);
  const headings: Array<{ slideNumber: number; lineIndex: number }> = [];

  lines.forEach((line, lineIndex) => {
    const match = line.match(SLIDE_HEADING_RE);
    if (match) {
      headings.push({ slideNumber: Number(match[1]), lineIndex });
    }
  });

  if (!headings.length) {
    return [{ slideNumber: 1, text: trimmed }];
  }

  const slides: ParsedSlideNarration[] = [];
  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index];
    const nextHeading = headings[index + 1];
    const bodyLines = lines.slice(
      heading.lineIndex + 1,
      nextHeading ? nextHeading.lineIndex : lines.length,
    );
    const text = bodyLines.join("\n").trim();
    if (!text) continue;
    slides.push({ slideNumber: heading.slideNumber, text });
  }

  return slides.sort((a, b) => a.slideNumber - b.slideNumber);
}

export function slideNarrationFileName(slideNumber: number) {
  return `slide-${String(slideNumber).padStart(2, "0")}.mp3`;
}
