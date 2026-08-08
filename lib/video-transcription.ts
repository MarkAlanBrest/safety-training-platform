export type TranscriptionSegment = {
  start: number;
  end: number;
  text: string;
};

export function formatVttTimestamp(seconds: number): string {
  const totalMs = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(totalMs / 3_600_000);
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000);
  const secs = Math.floor((totalMs % 60_000) / 1000);
  const ms = totalMs % 1000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}

export function segmentsToWebVtt(
  segments: TranscriptionSegment[],
  options?: { timeOffsetSeconds?: number },
): string {
  const offset = options?.timeOffsetSeconds || 0;
  const cues = segments
    .map((segment) => ({
      start: segment.start + offset,
      end: segment.end + offset,
      text: segment.text.replace(/\s+/g, " ").trim(),
    }))
    .filter((segment) => segment.text && segment.end > segment.start);

  if (!cues.length) return "WEBVTT\n\n";

  const body = cues
    .map(
      (cue) =>
        `${formatVttTimestamp(cue.start)} --> ${formatVttTimestamp(cue.end)}\n${cue.text}`,
    )
    .join("\n\n");

  return `WEBVTT\n\n${body}\n`;
}

export function parseWebVttToSegments(source: string): TranscriptionSegment[] {
  const segments: TranscriptionSegment[] = [];
  const lines = source.replace(/^\uFEFF/, "").trim().split("\n");
  let index = 0;

  while (index < lines.length) {
    const line = lines[index]?.trim() || "";
    index += 1;
    if (!line || line === "WEBVTT" || line.startsWith("NOTE")) continue;
    if (!line.includes("-->")) continue;

    const [rawStart, rawEnd] = line.split("-->").map((value) => value.trim());
    const start = parseVttTimestamp(rawStart || "");
    const end = parseVttTimestamp(rawEnd || "");
    const textLines: string[] = [];
    while (index < lines.length && lines[index]?.trim() && !lines[index]?.includes("-->")) {
      textLines.push(lines[index]?.trim() || "");
      index += 1;
    }
    const text = textLines.join(" ").trim();
    if (text && Number.isFinite(start) && Number.isFinite(end)) {
      segments.push({ start, end, text });
    }
  }

  return segments;
}

export function mergeWebVttFiles(parts: string[]): string {
  const segments: TranscriptionSegment[] = [];

  for (const part of parts) {
    segments.push(...parseWebVttToSegments(part));
  }

  return segmentsToWebVtt(segments);
}

function parseVttTimestamp(value: string): number {
  const match = value.trim().match(/^(?:(\d+):)?(\d+):(\d{2})(?:\.(\d{1,3}))?$/);
  if (!match) return NaN;
  const hours = match[1] ? Number(match[1]) : 0;
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const ms = match[4] ? Number(match[4].padEnd(3, "0")) : 0;
  return hours * 3600 + minutes * 60 + seconds + ms / 1000;
}

export function parseWhisperSegments(payload: unknown): TranscriptionSegment[] {
  if (!payload || typeof payload !== "object") return [];
  const segments = (payload as { segments?: unknown }).segments;
  if (!Array.isArray(segments)) return [];

  return segments
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const segment = item as { start?: unknown; end?: unknown; text?: unknown };
      const start = Number(segment.start);
      const end = Number(segment.end);
      const text = String(segment.text || "").trim();
      if (!Number.isFinite(start) || !Number.isFinite(end) || !text) return null;
      return { start, end, text };
    })
    .filter((segment): segment is TranscriptionSegment => Boolean(segment));
}
