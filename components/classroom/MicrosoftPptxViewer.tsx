"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, LoaderCircle, RefreshCw } from "lucide-react";
import { canUseMicrosoftOfficeEmbed } from "@/lib/classroom";

const OFFICE_LOAD_TIMEOUT_MS = 30_000;

export default function MicrosoftPptxViewer({
  deckUrl,
  embedDeckUrl,
  slideIndex,
  title,
  slideCount,
  currentSlideNumber,
  preloadNextSlide = false,
  onPreviousSlide,
  onNextSlide,
  fallback,
}: {
  deckUrl: string;
  embedDeckUrl?: string;
  slideIndex: number;
  title: string;
  slideCount: number;
  currentSlideNumber: number;
  preloadNextSlide?: boolean;
  onPreviousSlide?: () => void;
  onNextSlide?: () => void;
  fallback?: ReactNode;
}) {
  const publicDeckUrl = embedDeckUrl || deckUrl;
  const [loadError, setLoadError] = useState("");
  const [useFallback, setUseFallback] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [loadedFrames, setLoadedFrames] = useState<Set<string>>(() => new Set());

  const frameUrl = (index: number) => {
    if (typeof window === "undefined") return "";
    const deck = new URL(publicDeckUrl, window.location.origin);
    const viewer = new URL("https://view.officeapps.live.com/op/embed.aspx");
    viewer.searchParams.set("src", deck.href);
    viewer.searchParams.set("wdSlideIndex", String(index + 1));
    return viewer.href;
  };

  const currentFrameKey = `${publicDeckUrl}:${slideIndex}:${reloadKey}`;
  const currentLoaded = loadedFrames.has(currentFrameKey);
  const frames = useMemo(() => {
    const indices = [slideIndex];
    if (preloadNextSlide && currentLoaded) indices.push(slideIndex + 1);
    return indices.map((index) => ({
      index,
      key: `${publicDeckUrl}:${index}:${reloadKey}`,
      url: frameUrl(index),
    }));
    // frameUrl is deliberately derived only from these primitive dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicDeckUrl, slideIndex, reloadKey, preloadNextSlide, currentLoaded]);

  useEffect(() => {
    let cancelled = false;
    setUseFallback(false);
    setLoadError("");

    async function verifyDeck() {
      if (!canUseMicrosoftOfficeEmbed(window.location.origin)) {
        if (!cancelled) setUseFallback(true);
        return;
      }

      try {
        const headResponse = await fetch(publicDeckUrl, { method: "HEAD", cache: "no-store" });
        if (!headResponse.ok) {
          if (!cancelled) setUseFallback(true);
          return;
        }

        const checkUrl = new URL("/api/classroom/office-embed-check", window.location.origin);
        checkUrl.searchParams.set("deckPath", publicDeckUrl);
        const checkResponse = await fetch(checkUrl.toString(), { cache: "no-store" });
        if (!checkResponse.ok) {
          if (!cancelled) setUseFallback(true);
          return;
        }

        const result = (await checkResponse.json()) as { ok?: boolean };
        if (!result.ok && !cancelled) {
          setUseFallback(true);
        }
      } catch {
        if (!cancelled) setUseFallback(true);
      }
    }

    void verifyDeck();
    return () => {
      cancelled = true;
    };
  }, [publicDeckUrl, reloadKey]);

  useEffect(() => {
    if (useFallback || currentLoaded || loadError) return;
    const timer = window.setTimeout(
      () => setLoadError("Microsoft PowerPoint is taking too long to load this slide."),
      OFFICE_LOAD_TIMEOUT_MS,
    );
    return () => window.clearTimeout(timer);
  }, [currentFrameKey, currentLoaded, loadError, useFallback]);

  if (useFallback && fallback) {
    return <div className="relative h-full min-h-0 w-full">{fallback}</div>;
  }

  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden bg-black" aria-label={title}>
      {!loadError && !useFallback
        ? frames.map((frame) => (
            <iframe
              key={frame.key}
              src={frame.url}
              title={`${title} — Microsoft PowerPoint viewer`}
              className={`absolute inset-x-0 bottom-0 top-1.5 w-full border-0 ${
                frame.index === slideIndex ? "visible z-0" : "invisible pointer-events-none -z-10"
              }`}
              allow="fullscreen; autoplay; clipboard-read; clipboard-write"
              allowFullScreen
              onLoad={() =>
                setLoadedFrames((current) => {
                  if (current.has(frame.key)) return current;
                  const next = new Set(current);
                  next.add(frame.key);
                  return next;
                })
              }
            />
          ))
        : null}
      {!currentLoaded && !loadError && !useFallback ? (
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
              onClick={() => {
                setLoadError("");
                setReloadKey((current) => current + 1);
              }}
              className="mx-auto mt-4 flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-bold text-slate-900"
            >
              <RefreshCw size={16} /> Try again
            </button>
          </div>
        </div>
      ) : null}
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
