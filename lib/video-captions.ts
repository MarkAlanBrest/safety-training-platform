export type VideoCaptionCue = {
  id: string;
  startSeconds: number;
  endSeconds: number;
  text: string;
};

function parseTimestampToken(value: string): number {
  const trimmed = value.trim();
  const segments = trimmed.split(":");
  if (segments.length === 3) {
    const hours = Number(segments[0]);
    const minutes = Number(segments[1]);
    const seconds = Number(segments[2]);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes) || !Number.isFinite(seconds)) {
      return NaN;
    }
    return hours * 3600 + minutes * 60 + seconds;
  }
  if (segments.length === 2) {
    const minutes = Number(segments[0]);
    const seconds = Number(segments[1]);
    if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return NaN;
    return minutes * 60 + seconds;
  }
  const seconds = Number(trimmed);
  return Number.isFinite(seconds) ? seconds : NaN;
}

function normalizeCueText(lines: string[]) {
  return lines
    .join("\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Parse a WebVTT captions file into timed cues. */
export function parseWebVtt(source: string): VideoCaptionCue[] {
  const normalized = source.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const blocks = normalized.split(/\n\n+/);
  const cues: VideoCaptionCue[] = [];

  for (const block of blocks) {
    const lines = block
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("NOTE") && line !== "WEBVTT");

    if (!lines.length) continue;

    let timingLineIndex = 0;
    if (!lines[0].includes("-->") && lines.length > 1) {
      timingLineIndex = 1;
    }

    const timingLine = lines[timingLineIndex];
    if (!timingLine?.includes("-->")) continue;

    const [rawStart, rawEnd] = timingLine.split("-->").map((part) => part.trim().split(/\s+/)[0]);
    const startSeconds = parseTimestampToken(rawStart || "");
    const endSeconds = parseTimestampToken(rawEnd || "");
    if (!Number.isFinite(startSeconds) || !Number.isFinite(endSeconds) || endSeconds <= startSeconds) {
      continue;
    }

    const text = normalizeCueText(lines.slice(timingLineIndex + 1));
    if (!text) continue;

    cues.push({
      id: `cue-${cues.length + 1}`,
      startSeconds,
      endSeconds,
      text,
    });
  }

  return cues.sort((a, b) => a.startSeconds - b.startSeconds);
}

export function findCueIndexAtTime(cues: VideoCaptionCue[], seconds: number): number {
  if (!cues.length || seconds < 0) return -1;

  for (let index = 0; index < cues.length; index += 1) {
    const cue = cues[index];
    if (seconds >= cue.startSeconds && seconds < cue.endSeconds) return index;
  }

  const last = cues[cues.length - 1];
  if (seconds >= last.startSeconds) return cues.length - 1;
  return -1;
}

export function narrationStateAtTime(cues: VideoCaptionCue[], seconds: number) {
  const activeIndex = findCueIndexAtTime(cues, seconds);
  const history =
    activeIndex > 0 ? cues.slice(0, activeIndex).map((cue) => cue.text).filter(Boolean) : [];
  const liveNarration = activeIndex >= 0 ? cues[activeIndex]?.text || "" : "";

  return { activeIndex, history, liveNarration };
}
