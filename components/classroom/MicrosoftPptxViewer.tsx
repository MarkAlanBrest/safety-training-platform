"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, LoaderCircle } from "lucide-react";

const OFFICE_LOAD_TIMEOUT_MS = 12_000;

export default function MicrosoftPptxViewer({
  deckUrl,
  embedDeckUrl,
  slideIndex,
  title,
  slideCount,
  currentSlideNumber,
  onPreviousSlide,
  onNextSlide,
  fallback,
}: {
  deckUrl: string;
  /** Public Office-embed URL. Microsoft's servers must fetch this without cookies. */
  embedDeckUrl?: string;
  slideIndex: number;
  title: string;
  slideCount: number;
  currentSlideNumber: number;
  onPreviousSlide?: () => void;
  onNextSlide?: () => void;
  fallback?: ReactNode;
}) {
  const publicDeckUrl = embedDeckUrl || deckUrl;
  const [viewerUrl, setViewerUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [useFallback, setUseFallback] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setUseFallback(false);
    setViewerUrl("");
    setLoading(true);

    async function prepareViewer() {
      try {
        const response = await fetch(publicDeckUrl, { method: "HEAD", cache: "no-store" });
        if (!response.ok) {
          if (!cancelled) setUseFallback(true);
          return;
        }
      } catch {
        if (!cancelled) setUseFallback(true);
        return;
      }

      const deck = new URL(publicDeckUrl, window.location.origin);
      const viewer = new URL("https://view.officeapps.live.com/op/embed.aspx");
      viewer.searchParams.set("src", deck.href);
      viewer.searchParams.set("wdSlideIndex", String(slideIndex + 1));
      if (!cancelled) {
        setViewerUrl(viewer.href);
        setLoading(true);
      }
    }

    void prepareViewer();
    return () => {
      cancelled = true;
    };
  }, [publicDeckUrl, slideIndex]);

  useEffect(() => {
    if (!viewerUrl || useFallback) return;
    const timer = window.setTimeout(() => setUseFallback(true), OFFICE_LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [viewerUrl, useFallback]);

  if (useFallback && fallback) {
    return <div className="relative h-full min-h-0 w-full">{fallback}</div>;
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
