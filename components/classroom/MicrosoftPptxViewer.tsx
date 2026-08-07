"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, LoaderCircle, RefreshCw } from "lucide-react";

const OFFICE_LOAD_TIMEOUT_MS = 30_000;

/**
 * Office Online is cross-origin, so its navigation events cannot be read by the
 * classroom. These controls are authoritative: they change both the Office
 * slide and the matching AI lesson beat.
 */
export default function MicrosoftPptxViewer({
  deckUrl,
  embedDeckUrl,
  slideIndex,
  title,
  slideCount,
  currentSlideNumber,
  onPreviousSlide,
  onNextSlide,
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
}) {
  const publicDeckUrl = embedDeckUrl || deckUrl;
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const viewerUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const deck = new URL(publicDeckUrl, window.location.origin);
    const viewer = new URL("https://view.officeapps.live.com/op/embed.aspx");
    viewer.searchParams.set("src", deck.href);
    viewer.searchParams.set("wdSlideIndex", String(slideIndex + 1));
    return viewer.href;
  }, [publicDeckUrl, slideIndex]);

  useEffect(() => {
    let cancelled = false;
    setLoadError("");

    async function verifyDeck() {
      try {
        const response = await fetch(publicDeckUrl, { method: "HEAD", cache: "no-store" });
        if (!response.ok && !cancelled) {
          setLoading(false);
          setLoadError(
            "PowerPoint could not access this presentation. Republish the course or re-upload the deck.",
          );
        }
      } catch {
        if (!cancelled) {
          setLoading(false);
          setLoadError("The presentation could not be reached. Check the connection and try again.");
        }
      }
    }

    void verifyDeck();
    return () => {
      cancelled = true;
    };
  }, [publicDeckUrl, reloadKey]);

  useEffect(() => {
    setLoading(true);
    setLoadError("");
  }, [viewerUrl, reloadKey]);

  useEffect(() => {
    if (!viewerUrl || !loading || loadError) return;
    const timer = window.setTimeout(() => {
      setLoading(false);
      setLoadError("Microsoft PowerPoint is taking too long to load this slide.");
    }, OFFICE_LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [viewerUrl, loading, loadError, reloadKey]);

  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden bg-black" aria-label={title}>
      {viewerUrl && !loadError ? (
        <div className="absolute inset-0 overflow-hidden">
          <iframe
            key={`${viewerUrl}-${reloadKey}`}
            src={viewerUrl}
            title={`${title} — Microsoft PowerPoint viewer`}
            className="h-full w-full border-0"
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
      {loadError ? (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0b1524] px-6 text-center text-white">
          <div className="max-w-md">
            <p className="text-sm font-semibold">{loadError}</p>
            <button
              type="button"
              onClick={() => setReloadKey((current) => current + 1)}
              className="mx-auto mt-4 flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-bold text-slate-900"
            >
              <RefreshCw size={16} />
              Try again
            </button>
          </div>
        </div>
      ) : null}
      <div className="absolute inset-x-0 bottom-0 z-20 flex h-10 items-center justify-center gap-3 border-t border-white/10 bg-slate-950 text-white">
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
