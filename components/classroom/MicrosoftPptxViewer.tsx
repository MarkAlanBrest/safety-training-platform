"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, LoaderCircle } from "lucide-react";

export default function MicrosoftPptxViewer({
  deckUrl,
  slideIndex,
  title,
  fallback,
  slideCount,
  currentSlideNumber,
  onPreviousSlide,
  onNextSlide,
}: {
  deckUrl: string;
  slideIndex: number;
  title: string;
  fallback?: ReactNode;
  slideCount: number;
  currentSlideNumber: number;
  onPreviousSlide?: () => void;
  onNextSlide?: () => void;
}) {
  const [viewerUrl, setViewerUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [useFallback, setUseFallback] = useState(false);

  useEffect(() => {
    const deck = new URL(deckUrl, window.location.origin);
    // A filename hint helps Office identify extensionless API download URLs as PowerPoints.
    deck.searchParams.set("file", "presentation.pptx");

    const viewer = new URL("https://view.officeapps.live.com/op/embed.aspx");
    viewer.searchParams.set("src", deck.href);
    viewer.searchParams.set("wdSlideIndex", String(slideIndex + 1));
    setViewerUrl(viewer.href);
    setLoading(true);
  }, [deckUrl, slideIndex]);

  useEffect(() => setUseFallback(false), [deckUrl]);

  if (useFallback && fallback) {
    return (
      <div className="relative h-full min-h-0 w-full bg-[#0b1524]">
        {fallback}
        <button
          type="button"
          onClick={() => setUseFallback(false)}
          className="absolute bottom-3 right-3 z-30 rounded-lg bg-slate-950/80 px-3 py-2 text-xs font-semibold text-white shadow-lg backdrop-blur"
        >
          Use Microsoft viewer
        </button>
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden bg-black" aria-label={title}>
      {viewerUrl ? (
        <div className="absolute inset-x-0 bottom-9 top-1 overflow-hidden">
          <iframe
            key={viewerUrl}
            src={viewerUrl}
            title={`${title} — Microsoft PowerPoint viewer`}
            className="h-[calc(100%+36px)] w-full border-0"
            allow="fullscreen; autoplay; clipboard-read; clipboard-write"
            allowFullScreen
            onLoad={() => setLoading(false)}
          />
        </div>
      ) : null}
      {loading ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#0b1524]">
          <LoaderCircle className="animate-spin text-amber-300" size={28} />
        </div>
      ) : null}
      {fallback ? (
        <button
          type="button"
          onClick={() => setUseFallback(true)}
          className="absolute bottom-3 right-3 z-30 rounded-lg bg-slate-950/80 px-3 py-2 text-xs font-semibold text-white shadow-lg backdrop-blur"
        >
          Use backup viewer
        </button>
      ) : null}
      <div className="absolute inset-x-0 bottom-0 z-20 flex h-9 items-center justify-center gap-3 bg-slate-950 text-white">
        <button
          type="button"
          onClick={onPreviousSlide}
          disabled={!onPreviousSlide}
          className="grid h-7 w-9 place-items-center rounded-md transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Previous slide"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="min-w-16 text-center text-xs font-semibold tabular-nums text-white/80">
          {currentSlideNumber} / {slideCount}
        </span>
        <button
          type="button"
          onClick={onNextSlide}
          disabled={!onNextSlide}
          className="grid h-7 w-9 place-items-center rounded-md transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Next slide"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
