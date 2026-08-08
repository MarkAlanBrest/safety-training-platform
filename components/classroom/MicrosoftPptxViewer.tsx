"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { classroomOfficeEmbedSrc } from "@/lib/classroom";

export default function MicrosoftPptxViewer({
  deckUrl,
  slideIndex,
  title,
  slideCount,
  currentSlideNumber,
  preloadNextSlide = false,
  onPreviousSlide,
  onNextSlide,
}: {
  deckUrl: string;
  slideIndex: number;
  title: string;
  slideCount: number;
  currentSlideNumber: number;
  preloadNextSlide?: boolean;
  onPreviousSlide?: () => void;
  onNextSlide?: () => void;
}) {
  const officeDeckSrc = useMemo(() => classroomOfficeEmbedSrc(deckUrl), [deckUrl]);

  const frameUrl = (index: number) => {
    const viewer = new URL("https://view.officeapps.live.com/op/embed.aspx");
    viewer.searchParams.set("src", officeDeckSrc);
    viewer.searchParams.set("wdSlideIndex", String(index + 1));
    return viewer.href;
  };

  const frames = useMemo(() => {
    const indices = [slideIndex];
    if (preloadNextSlide) indices.push(slideIndex + 1);
    return indices.map((index) => ({
      index,
      key: `${officeDeckSrc}:${index}:${slideIndex}`,
      url: frameUrl(index),
    }));
    // frameUrl is deliberately derived only from these primitive dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [officeDeckSrc, slideIndex, preloadNextSlide]);

  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden bg-black" aria-label={title}>
      {frames.map((frame) => (
        <iframe
          key={frame.key}
          src={frame.url}
          title={`${title} — Microsoft PowerPoint viewer`}
          className={`absolute inset-x-0 bottom-0 top-1.5 w-full border-0 ${
            frame.index === slideIndex ? "visible z-0" : "invisible pointer-events-none -z-10"
          }`}
          allow="fullscreen; autoplay; clipboard-read; clipboard-write"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
        />
      ))}
      <div className="absolute inset-x-0 bottom-0 z-20 flex h-10 items-center justify-center gap-3 border-t border-white/10 bg-slate-950 text-white">
        <button type="button" onClick={onPreviousSlide} disabled={!onPreviousSlide} className="grid h-7 w-9 place-items-center rounded-md transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-30" aria-label="Previous slide">
          <ChevronLeft size={18} />
        </button>
        <span className="min-w-16 text-center text-xs font-semibold tabular-nums text-white/80">
          {currentSlideNumber} / {slideCount}
        </span>
        <button type="button" onClick={onNextSlide} disabled={!onNextSlide} className="grid h-7 w-9 place-items-center rounded-md transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-30" aria-label="Next slide">
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
