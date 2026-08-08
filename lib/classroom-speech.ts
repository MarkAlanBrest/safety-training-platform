/** Client-safe speech helpers for classroom narration (no server/Node imports). */

import type { ClassroomCheckQuestion } from "@/lib/classroom";

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

/** Strip a comprehension prompt from reply text when the UI shows it separately. */
export function dedupeReplyWithCheckQuestion(
  reply: string,
  checkQuestion: ClassroomCheckQuestion | null,
): string {
  const cleaned = reply.trim();
  if (!checkQuestion?.prompt.trim()) return cleaned;
  const prompt = checkQuestion.prompt.trim();
  if (!cleaned) return "Let's check your understanding.";
  if (!cleaned.toLowerCase().includes(prompt.toLowerCase())) return cleaned;
  const withoutPrompt = cleaned
    .replace(new RegExp(prompt.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), "")
    .replace(/\s+/g, " ")
    .trim();
  return withoutPrompt || "Let's check your understanding.";
}

/** Speech for a turn — lead-in only when a Quick Check card is showing the question. */
export function speechTextForTurn(
  reply: string,
  checkQuestion: ClassroomCheckQuestion | null,
) {
  const cleanedReply = filterPrivateSpeechDirections(reply).trim();
  if (!checkQuestion) return cleanedReply || reply;
  const leadIn = dedupeReplyWithCheckQuestion(cleanedReply || reply, checkQuestion);
  return leadIn || "Here's a quick check for you.";
}

function authorCueLines(notes: string): string[] {
  return notes
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(\[AI\]|AI:)\s*/i, "").trim())
    .filter(Boolean);
}

/** Author cue: slide plays embedded PowerPoint audio; instructor TTS should stay silent. */
export function speakerNotesHaveEmbeddedNarration(notes?: string): boolean {
  if (!notes?.trim()) return false;
  return authorCueLines(notes).some(
    (line) =>
      /\b(?:narration|audio)\b[\s\S]{0,48}\bembedded\b/i.test(line) ||
      /\bembedded\b[\s\S]{0,48}\b(?:narration|audio)\b/i.test(line) ||
      /\bdo not narrate\b/i.test(line) ||
      /\bno (?:ai )?narration\b/i.test(line),
  );
}

const EMBEDDED_NARRATION_DEFAULT_WAIT_MS = 60_000;
const EMBEDDED_NARRATION_MAX_WAIT_MS = 600_000;

/** How long to hold auto-advance while embedded slide audio plays (author can override). */
export function embeddedNarrationWaitMs(
  notes?: string,
  defaultMs = EMBEDDED_NARRATION_DEFAULT_WAIT_MS,
): number {
  if (!notes?.trim()) return defaultMs;

  const secondMatch =
    notes.match(
      /\b(?:embedded\s+)?(?:audio|narration)\s+duration\s*:\s*(\d+)\s*(?:s(?:ec(?:onds?)?)?|seconds?)\b/i,
    ) ||
    notes.match(
      /\bwait\s+(?:for\s+)?(?:embedded\s+)?(?:audio|narration)\s+(?:for\s+)?(\d+)\s*(?:s(?:ec(?:onds?)?)?|seconds?)\b/i,
    ) ||
    notes.match(/\bduration\s*:\s*(\d+)\s*(?:s(?:ec(?:onds?)?)?|seconds?)\b/i) ||
    notes.match(/\bwait\s+(\d+)\s*(?:s(?:ec(?:onds?)?)?|seconds?)\b/i);

  if (secondMatch) {
    return Math.min(
      EMBEDDED_NARRATION_MAX_WAIT_MS,
      Math.max(5_000, Number(secondMatch[1]) * 1_000),
    );
  }

  const minuteMatch =
    notes.match(
      /\b(?:embedded\s+)?(?:audio|narration)\s+duration\s*:\s*(\d+)\s*(?:m(?:in(?:utes?)?)?|minutes?)\b/i,
    ) || notes.match(/\bwait\s+(\d+)\s*(?:m(?:in(?:utes?)?)?|minutes?)\b/i);

  if (minuteMatch) {
    return Math.min(
      EMBEDDED_NARRATION_MAX_WAIT_MS,
      Math.max(5_000, Number(minuteMatch[1]) * 60_000),
    );
  }

  return defaultMs;
}

/** Whether instructor TTS should run on this turn. */
export function shouldSpeakInstructorTurn(
  speakerNotes: string | undefined,
  options: {
    checkQuestion: ClassroomCheckQuestion | null;
    grading: boolean;
    reply: string;
  },
): boolean {
  if (!speakerNotesHaveEmbeddedNarration(speakerNotes)) return true;
  if (options.grading) return Boolean(filterPrivateSpeechDirections(options.reply).trim());
  if (options.checkQuestion) return true;
  return false;
}
