"use client";

import type { ClassroomSlideFocus } from "@/lib/classroom-focus";
import type { ClassroomSlideHotspot } from "@/lib/classroom-focus";

export default function SlideImageStage({
  imageUrl,
  title,
  focus,
  hotspots,
}: {
  imageUrl: string;
  title: string;
  focus?: ClassroomSlideFocus;
  hotspots?: ClassroomSlideHotspot[];
}) {
  const scale = Math.min(focus?.scale || 1, 1.55);
  const originX = focus ? `${focus.x}%` : "50%";
  const originY = focus ? `${focus.y}%` : "50%";

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[#0b1524] p-4 sm:p-6">
      <div className="relative h-full w-full max-h-full max-w-full">
        <div
          className="absolute inset-0 transition-transform duration-500 ease-out"
          style={{
            transform: focus ? `scale(${scale})` : "scale(1)",
            transformOrigin: `${originX} ${originY}`,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={title}
            className="h-full w-full object-contain"
            draggable={false}
          />
        </div>
      </div>

      {hotspots?.map((hotspot) => {
        const active = focus?.hotspotId === hotspot.id;
        return (
          <button
            key={hotspot.id}
            type="button"
            className={`absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition ${
              active
                ? "border-amber-300 bg-amber-400 shadow-[0_0_0_10px_rgba(251,191,36,.25)]"
                : "border-white/70 bg-amber-500/80 opacity-70"
            }`}
            style={{ left: `${hotspot.x}%`, top: `${hotspot.y}%` }}
            aria-label={hotspot.label}
          />
        );
      })}

      {focus ? (
        <>
          <div
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-amber-300 shadow-[0_0_30px_rgba(251,191,36,.45)] animate-pulse"
            style={{
              left: `${focus.x}%`,
              top: `${focus.y}%`,
              width: "84px",
              height: "84px",
            }}
          />
          <div
            className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-300 shadow-[0_0_18px_rgba(251,191,36,.9)]"
            style={{ left: `${focus.x}%`, top: `${focus.y}%` }}
          />
          {focus.label ? (
            <div
              className="pointer-events-none absolute max-w-xs -translate-x-1/2 rounded-2xl bg-[#07111f]/90 px-4 py-2 text-sm font-semibold text-amber-100 shadow-lg backdrop-blur"
              style={{
                left: `${focus.x}%`,
                top: `min(92%, ${focus.y + 8}%)`,
              }}
            >
              {focus.label}
            </div>
          ) : null}
        </>
      ) : null}

    </div>
  );
}
