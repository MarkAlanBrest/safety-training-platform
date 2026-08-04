export type ClassroomSlideHotspot = {
  id: string;
  label: string;
  description: string;
  x: number;
  y: number;
};

export type ClassroomSlideFocus = {
  x: number;
  y: number;
  scale?: number;
  hotspotId?: string;
  label?: string;
};

export function focusFromHotspot(
  hotspots: ClassroomSlideHotspot[] | undefined,
  hotspotId?: string | null,
): ClassroomSlideFocus | undefined {
  if (!hotspotId || !hotspots?.length) return undefined;
  const hotspot = hotspots.find((item) => item.id === hotspotId);
  if (!hotspot) return undefined;
  return {
    x: hotspot.x,
    y: hotspot.y,
    scale: 1.45,
    hotspotId: hotspot.id,
    label: hotspot.label,
  };
}

export function normalizeFocus(
  focus?: Partial<ClassroomSlideFocus> | null,
  hotspots?: ClassroomSlideHotspot[],
): ClassroomSlideFocus | undefined {
  if (focus?.hotspotId) {
    const fromHotspot = focusFromHotspot(hotspots, focus.hotspotId);
    if (fromHotspot) return fromHotspot;
  }
  if (typeof focus?.x === "number" && typeof focus?.y === "number") {
    return {
      x: Math.min(100, Math.max(0, focus.x)),
      y: Math.min(100, Math.max(0, focus.y)),
      scale: focus.scale ? Math.min(1.55, Math.max(1, focus.scale)) : 1.35,
      hotspotId: focus.hotspotId,
      label: focus.label,
    };
  }
  return undefined;
}

export function hotspotsSummary(hotspots: ClassroomSlideHotspot[] | undefined) {
  if (!hotspots?.length) return "No hotspots cataloged for this slide.";
  return hotspots
    .map(
      (hotspot) =>
        `- ${hotspot.id} "${hotspot.label}" at (${hotspot.x}%, ${hotspot.y}%): ${hotspot.description}`,
    )
    .join("\n");
}
