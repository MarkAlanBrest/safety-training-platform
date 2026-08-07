"use client";

import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import { LoaderCircle } from "lucide-react";
import {
  PowerPointViewer,
  type PowerPointViewerHandle,
  type ToolbarActionId,
} from "pptx-react-viewer";
import "pptx-react-viewer/styles";
import i18n from "@/lib/pptx-viewer-i18n";
import PptxSlideViewer from "@/components/classroom/PptxSlideViewer";

type Props = {
  deckUrl: string;
  slideIndex: number;
  title: string;
  fallbackImageUrl?: string;
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

type ViewerState = {
  content: Uint8Array | null;
  loadError: string;
  fetching: boolean;
  viewerReady: boolean;
  viewerFailed: boolean;
};

class PptxViewerErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) return this.props.fallback;
    return this.props.children;
  }
}

export default function ClassroomPptxPlayer({
  deckUrl,
  slideIndex,
  title,
  fallbackImageUrl,
}: Props) {
  return (
    <PptxViewerErrorBoundary
      fallback={
        <PptxSlideViewer
          deckUrl={deckUrl}
          slideIndex={slideIndex}
          title={title}
          fallbackImageUrl={fallbackImageUrl}
        />
      }
    >
      <ClassroomPptxPlayerInner
        deckUrl={deckUrl}
        slideIndex={slideIndex}
        title={title}
        fallbackImageUrl={fallbackImageUrl}
      />
    </PptxViewerErrorBoundary>
  );
}

function ClassroomPptxPlayerInner({
  deckUrl,
  slideIndex,
  title,
  fallbackImageUrl,
}: Props) {
  const [state, setState] = useState<ViewerState>({
    content: null,
    loadError: "",
    fetching: true,
    viewerReady: false,
    viewerFailed: false,
  });
  const viewerRef = useRef<PowerPointViewerHandle>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastSlideRef = useRef(slideIndex);

  const markViewerReady = useCallback(() => {
    setState((current) =>
      current.viewerReady ? current : { ...current, viewerReady: true },
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    setState((current) => ({
      ...current,
      fetching: true,
      loadError: "",
      viewerReady: false,
      viewerFailed: false,
    }));

    fetch(deckUrl)
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load the presentation file.");
        const buffer = await response.arrayBuffer();
        if (!cancelled) {
          setState((current) => ({
            ...current,
            content: new Uint8Array(buffer),
            fetching: false,
          }));
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setState((current) => ({
            ...current,
            loadError:
              error instanceof Error ? error.message : "Could not load the presentation file.",
            fetching: false,
          }));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [deckUrl]);

  const syncViewer = useCallback(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    try {
      viewer.setMode("preview");
      viewer.zoomReset();
      if (viewer.getActiveSlideIndex() !== slideIndex) {
        viewer.goTo(slideIndex);
      }
      lastSlideRef.current = slideIndex;
    } catch {
      setState((current) => ({ ...current, viewerFailed: true }));
    }
  }, [slideIndex]);

  useEffect(() => {
    if (!state.viewerReady || state.fetching || !state.content) return;
    syncViewer();
  }, [state.viewerReady, state.fetching, state.content, syncViewer]);

  useEffect(() => {
    if (!state.viewerReady) return;
    if (lastSlideRef.current === slideIndex) return;
    syncViewer();
  }, [slideIndex, state.viewerReady, syncViewer]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !state.viewerReady) return;

    const observer = new ResizeObserver(() => {
      window.requestAnimationFrame(() => syncViewer());
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [state.viewerReady, syncViewer]);

  if (state.viewerFailed) {
    return (
      <PptxSlideViewer
        deckUrl={deckUrl}
        slideIndex={slideIndex}
        title={title}
        fallbackImageUrl={fallbackImageUrl}
      />
    );
  }

  if (state.loadError) {
    return (
      <div className="flex h-full w-full items-center justify-center px-10 text-center text-slate-500">
        <p>{state.loadError}</p>
      </div>
    );
  }

  if (state.fetching || !state.content) {
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
      <I18nextProvider i18n={i18n}>
        <PowerPointViewer
          ref={viewerRef}
          content={state.content}
          canEdit={false}
          hiddenActions={HIDDEN_ACTIONS}
          className="h-full w-full"
          onActiveSlideChange={markViewerReady}
          onSlideCountChange={markViewerReady}
        />
      </I18nextProvider>
    </div>
  );
}
