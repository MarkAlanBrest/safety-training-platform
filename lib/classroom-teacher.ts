import "server-only";

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

