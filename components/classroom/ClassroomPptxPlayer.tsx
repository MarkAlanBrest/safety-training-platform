"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import {
  PowerPointViewer,
  type PowerPointViewerHandle,
  type ToolbarActionId,
} from "pptx-react-viewer";
import "pptx-react-viewer/styles";

type Props = {
  deckUrl: string;
  slideIndex: number;
  title: string;
};

const HIDDEN_ACTIONS: ToolbarActionId[] = [
  "file",
  "home",
  "insert",
  "draw",
  "design",
  "transitions",
  "animations",
  "slideShow",
  "record",
  "review",
  "view",
  "help",
  "share",
  "broadcast",
  "export",
  "undo",
  "redo",
  "notes",
  "fullscreen",
  "zoom",
  "navigation",
];

export default function ClassroomPptxPlayer({ deckUrl, slideIndex, title }: Props) {
  const [content, setContent] = useState<Uint8Array | null>(null);
  const [loadError, setLoadError] = useState("");
  const [fetching, setFetching] = useState(true);
  const [viewerReady, setViewerReady] = useState(false);
  const viewerRef = useRef<PowerPointViewerHandle>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastSlideRef = useRef(slideIndex);

  useEffect(() => {
    let cancelled = false;
    setFetching(true);
    setLoadError("");
    setViewerReady(false);

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

  const syncViewer = useCallback(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    viewer.setMode("preview");
    // zoomReset maps to zoom-to-fit inside pptx-react-viewer.
    viewer.zoomReset();

    if (viewer.getActiveSlideIndex() !== slideIndex) {
      viewer.goTo(slideIndex);
    }
    lastSlideRef.current = slideIndex;
  }, [slideIndex]);

  useEffect(() => {
    if (!viewerReady || fetching || !content) return;
    syncViewer();
  }, [viewerReady, fetching, content, syncViewer]);

  useEffect(() => {
    if (!viewerReady) return;
    if (lastSlideRef.current === slideIndex) return;
    syncViewer();
  }, [slideIndex, viewerReady, syncViewer]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !viewerReady) return;

    const observer = new ResizeObserver(() => {
      window.requestAnimationFrame(() => syncViewer());
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [viewerReady, syncViewer]);

  const message = loadError;

  if (message) {
    return (
      <div className="flex h-full w-full items-center justify-center px-10 text-center text-slate-500">
        <p>{message}</p>
      </div>
    );
  }

  if (fetching || !content) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#0b1524]">
        <LoaderCircle className="animate-spin text-amber-300" size={28} />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="classroom-pptx-player relative h-full min-h-0 w-full bg-[#0b1524]"
      aria-label={title}
    >
      <PowerPointViewer
        ref={viewerRef}
        content={content}
        canEdit={false}
        hiddenActions={HIDDEN_ACTIONS}
        className="h-full w-full"
        onActiveSlideChange={() => {
          setViewerReady(true);
          window.requestAnimationFrame(() => syncViewer());
        }}
        onSlideCountChange={() => {
          setViewerReady(true);
          window.requestAnimationFrame(() => syncViewer());
        }}
      />
    </div>
  );
}
