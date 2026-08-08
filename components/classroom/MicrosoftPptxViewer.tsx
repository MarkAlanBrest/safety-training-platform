"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { classroomOfficeEmbedSrc } from "@/lib/classroom";

const TOOLBAR_HEIGHT_PX = 40;
/** Office chromeless embed still leaves a bottom strip; extend and clip so slides fill the stage. */
const OFFICE_BOTTOM_CROP_PX = 44;

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
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const officeDeckSrc = useMemo(() => classroomOfficeEmbedSrc(deckUrl), [deckUrl]);

  useEffect(() => {
    const node = stageRef.current;
    if (!node) return;

    const update = () => {
      const { width, height } = node.getBoundingClientRect();
      if (width > 0 && height > 0) {
        setStageSize({ width: Math.round(width), height: Math.round(height) });
      }
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const frameUrl = (index: number) => {
    const viewer = new URL("https://view.officeapps.live.com/op/embed.aspx");
    viewer.searchParams.set("src", officeDeckSrc);
    viewer.searchParams.set("wdSlideIndex", String(index + 1));
    return viewer.href;
  };

  const frameHeight = stageSize.height + OFFICE_BOTTOM_CROP_PX;
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
    <div className="classroom-office-viewer relative h-full min-h-0 w-full overflow-hidden bg-black" aria-label={title}>
      <div
        ref={stageRef}
        className="classroom-office-viewer-stage absolute inset-x-0 top-0 overflow-hidden"
        style={{ bottom: TOOLBAR_HEIGHT_PX }}
      >
        {stageSize.width > 0 && stageSize.height > 0
          ? frames.map((frame) => (
              <iframe
                key={`${frame.key}:${stageSize.width}x${stageSize.height}`}
                src={frame.url}
                title={`${title} — Microsoft PowerPoint viewer`}
                width={stageSize.width}
                height={frameHeight}
                className={`classroom-office-viewer-frame pointer-events-none absolute left-0 top-0 border-0 ${
                  frame.index === slideIndex ? "visible z-0" : "invisible -z-10"
                }`}
                style={{ width: stageSize.width, height: frameHeight }}
                allow="fullscreen; autoplay; clipboard-read; clipboard-write"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
              />
            ))
          : null}
        {/* Block Office's click-to-advance; the class is paced by the instructor. */}
        <div
          className="classroom-office-viewer-shield absolute inset-0 z-10 cursor-default"
          aria-hidden="true"
        />
      </div>
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
