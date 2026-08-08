import type { ScormNarrationCue } from "@/lib/scorm-instructor";

/** Parse a pasted script with `=== location ===` section headers. */
export function parseScormNarrationDocument(source: string): ScormNarrationCue[] {
  const normalized = source.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const blocks = normalized.split(/(?:^|\n)===\s*(.+?)\s*===\n/);
  if (blocks.length > 1) {
    const cues: ScormNarrationCue[] = [];
    for (let index = 1; index < blocks.length; index += 2) {
      const location = blocks[index]?.trim();
      const text = blocks[index + 1]?.trim();
      if (location && text) cues.push({ location, text });
    }
    return cues;
  }

  return normalized
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split("\n");
      const first = lines[0]?.trim() || "";
      const locationMatch = first.match(/^(?:location|page|slide)\s*[:#-]\s*(.+)$/i);
      if (!locationMatch) return null;
      const text = lines.slice(1).join("\n").trim();
      if (!text) return null;
      return { location: locationMatch[1].trim(), text };
    })
    .filter((cue): cue is ScormNarrationCue => Boolean(cue));
}

export function formatScormNarrationDocument(cues: ScormNarrationCue[]): string {
  return cues
    .map((cue) => `=== ${cue.location} ===\n${cue.text.trim()}`)
    .join("\n\n");
}

export function normalizeScormNarrationCues(raw: unknown): ScormNarrationCue[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is ScormNarrationCue => {
      if (!item || typeof item !== "object") return false;
      const cue = item as ScormNarrationCue;
      return typeof cue.location === "string" && typeof cue.text === "string";
    })
    .map((cue) => ({ location: cue.location.trim(), text: cue.text.trim() }))
    .filter((cue) => cue.location && cue.text);
}
