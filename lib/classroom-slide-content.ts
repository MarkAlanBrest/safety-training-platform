import type { ClassroomSlide } from "@/lib/classroom";

export type ClassroomSlideLayout = "title" | "content" | "image" | "split";

export type StructuredClassroomSlide = ClassroomSlide & {
  subtitle?: string;
  bullets: string[];
  highlight?: string;
  layout: ClassroomSlideLayout;
};

export function splitBodyIntoBullets(bodyText: string) {
  const normalized = bodyText.replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  if (normalized.includes("•")) {
    return normalized
      .split("•")
      .map((part) => part.trim())
      .filter(Boolean)
      .slice(0, 6);
  }

  const sentences = normalized
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 12);

  if (sentences.length >= 2) return sentences.slice(0, 6);
  return [normalized];
}

export function structureClassroomSlide(slide: ClassroomSlide): StructuredClassroomSlide {
  const bullets =
    slide.bullets?.filter(Boolean).slice(0, 6) ||
    splitBodyIntoBullets(slide.bodyText).filter((bullet) => bullet !== slide.title);

  const hasImage = Boolean(slide.imageUrl || slide.imageDataUrl);
  const layout: ClassroomSlideLayout =
    slide.layout ||
    (slide.index === 0 && bullets.length <= 1
      ? "title"
      : hasImage && bullets.length
        ? "split"
        : hasImage
          ? "image"
          : "content");

  return {
    ...slide,
    subtitle: slide.subtitle,
    bullets: bullets.length ? bullets : splitBodyIntoBullets(slide.bodyText).slice(0, 4),
    highlight: slide.highlight,
    layout,
  };
}

export function mergeEnhancedSlide(
  slide: ClassroomSlide,
  enhanced?: Partial<StructuredClassroomSlide>,
): StructuredClassroomSlide {
  const merged: ClassroomSlide = {
    ...slide,
    title: enhanced?.title?.trim() || slide.title,
    subtitle: enhanced?.subtitle?.trim() || slide.subtitle,
    bodyText: enhanced?.bodyText?.trim() || slide.bodyText,
    bullets: enhanced?.bullets?.filter(Boolean).slice(0, 6) || slide.bullets,
    highlight: enhanced?.highlight?.trim() || slide.highlight,
    layout: enhanced?.layout || slide.layout,
  };
  return structureClassroomSlide(merged);
}
