"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import {
  SlideCanvas,
  useViewerBuildingBlocks,
  type PowerPointViewerHandle,
} from "pptx-react-viewer";
import "pptx-react-viewer/styles";

type Props = {
  deckUrl: string;
  slideIndex: number;
  title: string;
};

export default function ClassroomPptxPlayer({ deckUrl, slideIndex, title }: Props) {
  const [content, setContent] = useState<Uint8Array | null>(null);
  const [loadError, setLoadError] = useState("");
  const [fetching, setFetching] = useState(true);
  const viewerRef = useRef<PowerPointViewerHandle>(null);
  const lastSlideRef = useRef(slideIndex);

  useEffect(() => {
    let cancelled = false;
    setFetching(true);
    setLoadError("");

    fetch(deckUrl)
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load the presentation file.");
        const buffer = await response.arrayBuffer();
        if (!cancelled) {
          setContent(new Uint8Array(buffer));
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(
            error instanceof Error ? error.message : "Could not load the presentation file.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setFetching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [deckUrl]);

  const { canvasProps, loading, error } = useViewerBuildingBlocks({
    content,
    canEdit: false,
    handle: viewerRef,
    autosaveEnabled: false,
  });

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || loading || fetching) return;
    if (lastSlideRef.current === slideIndex) return;
    lastSlideRef.current = slideIndex;
    viewer.goTo(slideIndex);
  }, [slideIndex, loading, fetching]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || loading || fetching) return;
    if (viewer.getActiveSlideIndex() !== slideIndex) {
      viewer.goTo(slideIndex);
      lastSlideRef.current = slideIndex;
    }
  }, [slideIndex, loading, fetching, content]);

  const message = loadError || error;

  if (message) {
    return (
      <div className="flex h-full w-full items-center justify-center px-10 text-center text-slate-500">
        <p>{message}</p>
      </div>
    );
  }

  if (fetching || loading || !content) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#0b1524]">
        <LoaderCircle className="animate-spin text-amber-300" size={28} />
      </div>
    );
  }

  return (
    <div
      className="relative flex h-full min-h-0 w-full items-center justify-center overflow-hidden bg-[#0b1524]"
      aria-label={title}
    >
      <div className="h-full w-full [&_.pptx-slide-canvas]:mx-auto [&_.pptx-slide-canvas]:max-h-full [&_.pptx-slide-canvas]:max-w-full">
        <SlideCanvas {...canvasProps} />
      </div>
    </div>
  );
}
