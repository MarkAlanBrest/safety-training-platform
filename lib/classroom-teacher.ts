import type { ClassroomPlan, ClassroomSlide, PresentationView } from "@/lib/classroom";
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
    (
      presentation.type === "question" ||
      presentation.type === "exercise" ||
      presentation.type === "assessment"
        ? presentation.choices || []
        : []
    ).map((choice) => choice.toLowerCase().trim()),
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

type TeacherChatMessage = { role: "user" | "assistant"; content: string };

/** Slide index the learner currently sees — prefer presentation over a stale body field. */
export function resolveRequestSlideIndex(
  bodySlideIndex: number,
  presentation: PresentationView | undefined,
  plan: ClassroomPlan,
): number {
  const max = Math.max(0, plan.slides.length - 1);
  if (presentation?.type === "slide") {
    const idx = presentation.slideIndex;
    if (Number.isInteger(idx)) {
      return Math.min(max, Math.max(0, idx));
    }
  }
  if (Number.isInteger(bodySlideIndex)) {
    return Math.min(max, Math.max(0, bodySlideIndex));
  }
  return 0;
}

/** Match slide titles or explicit slide/topic numbers mentioned in instructor speech. */
export function inferSlideIndexFromReply(
  plan: ClassroomPlan,
  text: string,
): number | null {
  const lowered = text.toLowerCase();
  let bestIndex: number | null = null;
  let bestScore = 0;

  for (let index = 0; index < plan.slides.length; index += 1) {
    const title = plan.slides[index].title.trim();
    if (title.length < 4) continue;
    const titleLower = title.toLowerCase();
    if (lowered.includes(titleLower)) {
      const score = title.length;
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }
  }

  const slideNumberMatch = text.match(/\b(?:slide|topic|section)\s+(\d+)\b/i);
  if (slideNumberMatch) {
    const parsed = Number(slideNumberMatch[1]) - 1;
    if (parsed >= 0 && parsed < plan.slides.length) {
      return parsed;
    }
  }

  return bestIndex;
}

/** Keep the slide stage visible during open-ended checks (question lives in chat/speech). */
export function coerceSlideTeachingView(
  presentation: PresentationView,
  contextSlideIndex: number,
  plan: ClassroomPlan,
): PresentationView {
  if (presentation.type !== "question" && presentation.type !== "exercise") {
    return presentation;
  }

  const slide = plan.slides[contextSlideIndex] || plan.slides[0];
  return {
    type: "slide",
    slideIndex: contextSlideIndex,
    headline: slide?.title || presentation.headline,
  };
}

/** Align on-screen slide with what the instructor is actually teaching. */
export function alignPresentationSlide(
  plan: ClassroomPlan,
  contextSlideIndex: number,
  presentation: PresentationView,
  messages: TeacherChatMessage[],
  reply: string,
): PresentationView {
  if (presentation.type !== "slide") return presentation;

  const lastUser = messages.filter((message) => message.role === "user").pop();
  const continuing =
    lastUser?.role === "user" && /continue teaching/i.test(lastUser.content);

  const inferred = inferSlideIndexFromReply(plan, reply);
  let slideIndex = presentation.slideIndex;

  if (inferred !== null) {
    slideIndex = inferred;
  } else if (
    continuing &&
    slideIndex === contextSlideIndex &&
    /\b(next (slide|topic|section)|moving on|let'?s move|now we)\b/i.test(reply) &&
    contextSlideIndex < plan.slides.length - 1
  ) {
    slideIndex = contextSlideIndex + 1;
  }

  const slide = plan.slides[slideIndex];
  if (!slide) return presentation;

  if (slideIndex === presentation.slideIndex) return presentation;

  return {
    ...presentation,
    slideIndex,
    headline: presentation.headline || slide.title,
    focus: undefined,
  };
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
