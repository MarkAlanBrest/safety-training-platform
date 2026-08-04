"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import SlideImageStage from "@/components/classroom/SlideImageStage";

type PptxRendererLike = {
  slideCount: number;
  load: (source: ArrayBuffer) => Promise<void>;
  renderSlide: (index: number, canvas: HTMLCanvasElement, width?: number) => Promise<void>;
  destroy: () => void;
};

async function waitForFonts() {
  if (typeof document !== "undefined" && "fonts" in document) {
    try {
      await document.fonts.ready;
    } catch {
      // Ignore font readiness failures.
    }
  }
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

export default function PptxSlideViewer({
  deckUrl,
  slideIndex,
  title,
  fallbackImageUrl,
}: {
  deckUrl: string;
  slideIndex: number;
  title: string;
  fallbackImageUrl?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<PptxRendererLike | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const rendererPromise = (async () => {
      const response = await fetch(deckUrl);
      if (!response.ok) throw new Error("deck fetch failed");
      const buffer = await response.arrayBuffer();
      const { default: PptxRenderer } = await import("pptx-browser");
      const renderer = new PptxRenderer() as unknown as PptxRendererLike;
      await renderer.load(buffer);
      return renderer;
    })();

    rendererPromise
      .then((renderer) => {
        if (cancelled) {
          renderer.destroy();
          return;
        }
        rendererRef.current = renderer;
        setFailed(false);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      rendererRef.current?.destroy();
      rendererRef.current = null;
    };
  }, [deckUrl]);

  useEffect(() => {
    const renderer = rendererRef.current;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!renderer || !canvas || !container || failed) return;

    let cancelled = false;

    async function paint() {
      if (!renderer || !canvas || slideIndex < 0 || slideIndex >= renderer.slideCount) return;
      const width = Math.min(
        2400,
        Math.max(1280, Math.round((container?.clientWidth || 960) * 2)),
      );
      try {
        await renderer.renderSlide(slideIndex, canvas, width);
        await waitForFonts();
      } catch {
        if (!cancelled) setFailed(true);
      }
    }

    void paint();

    return () => {
      cancelled = true;
    };
  }, [slideIndex, failed, loading]);

  if (failed && fallbackImageUrl) {
    return <SlideImageStage imageUrl={fallbackImageUrl} title={title} />;
  }

  if (failed) {
    return (
      <div className="flex h-full w-full items-center justify-center px-10 text-center text-slate-500">
        <p>Could not load this slide from the presentation file.</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative flex h-full min-h-0 w-full items-center justify-center bg-[#0b1524] p-2 sm:p-3"
    >
      <canvas
        ref={canvasRef}
        className="max-h-full max-w-full"
        aria-label={title}
        role="img"
      />
      {loading ? (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0b1524]/80">
          <LoaderCircle className="animate-spin text-amber-300" size={28} />
        </div>
      ) : null}
    </div>
  );
}
