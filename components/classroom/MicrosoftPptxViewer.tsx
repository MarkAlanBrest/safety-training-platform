"use client";

import { useEffect, useState, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";

export default function MicrosoftPptxViewer({
  deckUrl,
  slideIndex,
  title,
  fallback,
}: {
  deckUrl: string;
  slideIndex: number;
  title: string;
  fallback?: ReactNode;
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
        <iframe
          key={viewerUrl}
          src={viewerUrl}
          title={`${title} — Microsoft PowerPoint viewer`}
          className="h-full w-full border-0"
          allow="fullscreen; autoplay; clipboard-read; clipboard-write"
          allowFullScreen
          onLoad={() => setLoading(false)}
        />
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
    </div>
  );
}
