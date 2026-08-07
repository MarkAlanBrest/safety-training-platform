/** Client-safe speech helpers for classroom narration (no server/Node imports). */

/** Remove private author directions before text is sent to TTS. */
export function spokenTextFromSpeakerNotes(notes: string): string {
  if (!notes?.trim()) return "";
  return notes
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(
      (line) =>
        line &&
        !/^(\[AI\]|AI:)\s*/i.test(line) &&
        !/^(AI instructor notes|instructor notes|speaker notes):?$/i.test(line),
    )
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Strip private author cues from any narration bound for speech output. */
export function filterPrivateSpeechDirections(text: string): string {
  if (!text?.trim()) return "";
  const stripped = spokenTextFromSpeakerNotes(text);
  if (stripped) return stripped;
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(\[AI\]|AI:)\s*/i, "").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Split instructor speech so the first chunk reaches TTS quickly. */
export function speechChunks(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const sentences = trimmed.split(/(?<=[.!?])\s+/).filter((part) => part.trim());
  if (sentences.length <= 1) return [trimmed];

  let first = sentences[0];
  if (first.length < 100 && sentences[1]) {
    first = `${first} ${sentences[1]}`.trim();
  }

  const remainder = trimmed.slice(first.length).trim();
  return remainder ? [first, remainder] : [first];
}
