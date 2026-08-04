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
  return (
    <div className="flex h-full min-h-0 w-full items-center justify-center bg-[#0b1524] p-2 sm:p-3">
      <div className="relative flex h-full w-full items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={title}
          className="max-h-full max-w-full object-contain"
          style={{ imageRendering: "auto" }}
          draggable={false}
          decoding="async"
        />

        <div className="pointer-events-none absolute inset-0">
          {hotspots?.map((hotspot) => {
            const active = focus?.hotspotId === hotspot.id;
            return (
              <span
                key={hotspot.id}
                className={`absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 ${
                  active
                    ? "border-amber-300 bg-amber-400 shadow-[0_0_0_8px_rgba(251,191,36,.25)]"
                    : "border-white/70 bg-amber-500/80 opacity-60"
                }`}
                style={{ left: `${hotspot.x}%`, top: `${hotspot.y}%` }}
              />
            );
          })}

          {focus ? (
            <>
              <span
                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-amber-300 shadow-[0_0_24px_rgba(251,191,36,.45)]"
                style={{
                  left: `${focus.x}%`,
                  top: `${focus.y}%`,
                  width: "72px",
                  height: "72px",
                }}
              />
              <span
                className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-300 shadow-[0_0_14px_rgba(251,191,36,.9)]"
                style={{ left: `${focus.x}%`, top: `${focus.y}%` }}
              />
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
