import type { ClassroomSlide, PresentationView } from "@/lib/classroom";
import { focusFromHotspot } from "@/lib/classroom-focus";

/** Resolve slide image as a data URL for vision models. */
export async function resolveSlideImageDataUrl(
  slide: ClassroomSlide,
  requestOrigin: string,
): Promise<string | null> {
  if (slide.imageDataUrl?.startsWith("data:")) {
    return slide.imageDataUrl;
  }
  if (slide.imageUrl?.startsWith("data:")) {
    return slide.imageUrl;
  }
  if (slide.imageUrl?.startsWith("http://") || slide.imageUrl?.startsWith("https://")) {
    return slide.imageUrl;
  }
  if (!slide.imageUrl?.startsWith("/")) {
    return null;
  }

  try {
    const response = await fetch(`${requestOrigin}${slide.imageUrl}`);
    if (!response.ok) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    const mime = response.headers.get("content-type") || "image/jpeg";
    return `data:${mime};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

/** Only keep slide focus when it targets a cataloged hotspot — never random coordinates. */
export function sanitizeTeacherSlidePresentation(
  view: PresentationView,
  slide: ClassroomSlide,
): PresentationView {
  if (view.type !== "slide") return view;

  const hotspotId = view.focus?.hotspotId;
  if (!hotspotId || !slide.hotspots?.length) {
    if (view.focus) {
      const { focus: _focus, ...rest } = view;
      return rest;
    }
    return view;
  }

  const fromHotspot = focusFromHotspot(slide.hotspots, hotspotId);
  if (!fromHotspot) {
    const { focus: _focus, ...rest } = view;
    return rest;
  }

  const requestedScale = view.focus?.scale;
  const scale =
    typeof requestedScale === "number" && requestedScale > 1
      ? Math.min(2.2, Math.max(1.25, requestedScale))
      : 1.4;

  return {
    ...view,
    focus: {
      ...fromHotspot,
      scale,
      label: view.focus?.label || fromHotspot.label,
    },
  };
}

const OPEN_PROMPT_PATTERN =
  /\b(tell me|what do you|how would you|how do you|can you tell|could you tell|share what|describe what|what would you|what do you think|what have you|do you know|have you ever)\b/i;

/** True when the learner should answer — checkpoint UI, shortcut buttons, or a question. */
export function inferExpectsResponse(
  reply: string,
  presentation: PresentationView,
  quickReplies: string[] = [],
): boolean {
  if (quickReplies.length > 0) return true;
  if (
    presentation.type === "question" ||
    presentation.type === "exercise" ||
    presentation.type === "assessment"
  ) {
    return true;
  }

  const trimmed = reply.trim();
  if (!trimmed) return false;

  if (/\?/.test(trimmed)) return true;

  const lastSentence =
    trimmed.split(/(?<=[.!?])\s+/).pop()?.trim() || trimmed;
  return OPEN_PROMPT_PATTERN.test(lastSentence);
}

/** Presentation modes where the instructor should keep driving after a beat. */
export function shouldAutoContinueTeaching(
  expectsResponse: boolean,
  presentation: PresentationView,
  quickReplies: string[] = [],
): boolean {
  if (expectsResponse || quickReplies.length > 0) return false;
  if (
    presentation.type === "question" ||
    presentation.type === "exercise" ||
    presentation.type === "assessment" ||
    presentation.type === "flashcard" ||
    presentation.type === "dragdrop"
  ) {
    return false;
  }
  return presentation.type === "welcome" || presentation.type === "slide";
}

function looksLikeMultipleChoiceOption(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (/^[a-d]([\).:\s]|$)/i.test(trimmed)) return true;
  if (trimmed.length <= 2) return true;
  return false;
}

/** Keep helpful shortcut buttons; strip anything that looks like a leaked answer. */
export function sanitizeQuickReplies(
  replies: string[] | undefined,
  presentation: PresentationView,
): string[] {
  if (!replies?.length) return [];

  const choiceSet = new Set(
    (presentation.choices || []).map((choice) => choice.toLowerCase().trim()),
  );
  const isCheckpoint =
    presentation.type === "question" ||
    presentation.type === "exercise" ||
    presentation.type === "assessment";

  const cleaned: string[] = [];
  for (const reply of replies) {
    const trimmed = reply.trim();
    if (!trimmed || trimmed.length > 80) continue;
    if (choiceSet.has(trimmed.toLowerCase())) continue;
    if (isCheckpoint && looksLikeMultipleChoiceOption(trimmed)) continue;
    if (cleaned.includes(trimmed)) continue;
    cleaned.push(trimmed);
    if (cleaned.length >= 4) break;
  }

  return cleaned;
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
