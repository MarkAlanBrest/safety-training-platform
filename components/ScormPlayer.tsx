"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Award, LoaderCircle, Maximize2 } from "lucide-react";

type RuntimeData = Record<string, string>;

const SCORM_UI_ONLY_LINE = /^(?:next|previous|back|continue|submit|menu|resources|play|pause|replay|volume|mute|unmute|close|exit|help|notes|seekbar|slide\s+\d+\s+of\s+\d+)$/i;

function cleanVisibleScormText(source: string) {
  const seen = new Set<string>();
  return source
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => {
      const key = line.toLowerCase();
      if (!line || line.length > 500 || SCORM_UI_ONLY_LINE.test(line) || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1800);
}

function visibleTextFromFrame(frame: HTMLIFrameElement) {
  const candidates: Array<{ depth: number; text: string }> = [];
  const visit = (doc: Document, depth: number) => {
    const text = cleanVisibleScormText(doc.body?.innerText || "");
    if (text) candidates.push({ depth, text });
    for (const child of Array.from(doc.querySelectorAll("iframe"))) {
      try {
        if (child.contentDocument) visit(child.contentDocument, depth + 1);
      } catch {
        // A third-party embedded frame cannot be inspected; continue with the SCORM document.
      }
    }
  };
  try {
    if (frame.contentDocument) visit(frame.contentDocument, 0);
  } catch {
    return "";
  }
  // Authoring tools commonly place the active slide in a nested same-origin frame.
  // Prefer the deepest useful document so package navigation chrome is not narrated.
  return candidates
    .filter((candidate) => candidate.text.split(/\s+/).length >= 3)
    .sort((a, b) => b.depth - a.depth || b.text.length - a.text.length)[0]?.text || "";
}

/** Authors mark the text meant for narration with `id="ai-narration"` or a `data-ai-narration` attribute. */
const NARRATION_MARKER_SELECTOR = "#ai-narration, [data-ai-narration]";

/** Rejects `display:none`/`visibility:hidden` elements and screen-reader-only tricks (1px boxes, off-canvas positioning) that would otherwise count as "visible". */
function isVisibleElement(element: Element) {
  if (!(element instanceof HTMLElement)) return false;
  const withVisibilityCheck = element as HTMLElement & { checkVisibility?: () => boolean };
  if (typeof withVisibilityCheck.checkVisibility === "function") {
    try {
      if (!withVisibilityCheck.checkVisibility()) return false;
    } catch {
      // Fall through to the geometry-based check below.
    }
  } else if (!element.offsetParent && element.getClientRects().length === 0) {
    return false;
  }
  const rect = element.getBoundingClientRect();
  const view = element.ownerDocument.defaultView;
  if (rect.width < 4 || rect.height < 4) return false;
  if (view && (rect.right <= 0 || rect.bottom <= 0 || rect.left >= view.innerWidth || rect.top >= view.innerHeight)) {
    return false;
  }
  return true;
}

/**
 * Reads the current screen's narration text from an author-marked element,
 * falling back to a best-effort scrape of the visible page when the package
 * has no marker. Only the marker's own text is used — never the whole page —
 * so navigation chrome and unrelated UI never gets read aloud.
 *
 * When more than one marked element is visible at once (e.g. mid-transition,
 * or a package that never fully hides inactive screens), the first one in
 * document order wins — a fixed, stable choice rather than one that can flip
 * between poll ticks and sound like narration jumping between two screens.
 */
function narrationTextFromFrame(frame: HTMLIFrameElement) {
  const candidates: Array<{ depth: number; text: string }> = [];
  const visit = (doc: Document, depth: number) => {
    for (const marker of Array.from(doc.querySelectorAll(NARRATION_MARKER_SELECTOR))) {
      if (!isVisibleElement(marker)) continue;
      const text = cleanVisibleScormText((marker as HTMLElement).innerText || marker.textContent || "");
      if (text) candidates.push({ depth, text });
    }
    for (const child of Array.from(doc.querySelectorAll("iframe"))) {
      try {
        if (child.contentDocument) visit(child.contentDocument, depth + 1);
      } catch {
        // A third-party embedded frame cannot be inspected; continue with the SCORM document.
      }
    }
  };
  try {
    if (frame.contentDocument) visit(frame.contentDocument, 0);
  } catch {
    return "";
  }
  if (candidates.length) {
    // Stable sort: ties keep document order instead of flip-flopping.
    return candidates.sort((a, b) => b.depth - a.depth)[0].text;
  }
  return visibleTextFromFrame(frame);
}

export type ScormRuntimeChange = {
  key: string;
  value: string;
  snapshot: RuntimeData;
};

export default function ScormPlayer({
  title,
  slug,
  entryPoint,
  version,
  preview = false,
  embedded = false,
  className,
  onRuntimeChange,
  onVisibleTextChange,
}: {
  title: string;
  slug: string;
  entryPoint: string;
  version: string;
  preview?: boolean;
  embedded?: boolean;
  className?: string;
  onRuntimeChange?: (change: ScormRuntimeChange) => void;
  /** Narration text for the current screen, read from an `#ai-narration` / `[data-ai-narration]` marker inside the same-origin SCORM frame (falls back to scraping visible text if no marker is present). */
  onVisibleTextChange?: (text: string) => void;
}) {
  const searchParams = useSearchParams();
  const code = searchParams?.get("code") || "";
  const dataRef = useRef<RuntimeData>({});
  const onRuntimeChangeRef = useRef(onRuntimeChange);
  const onVisibleTextChangeRef = useRef(onVisibleTextChange);
  const [ready, setReady] = useState(false);
  const [runtimeReady, setRuntimeReady] = useState(false);
  const [error, setError] = useState("");
  const [certificateUrl, setCertificateUrl] = useState("");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    onRuntimeChangeRef.current = onRuntimeChange;
  }, [onRuntimeChange]);

  useEffect(() => {
    onVisibleTextChangeRef.current = onVisibleTextChange;
  }, [onVisibleTextChange]);

  useEffect(() => {
    if (!ready || !runtimeReady || !onVisibleTextChange) return;
    let lastCandidate = "";
    let candidateSince = 0;
    let lastDelivered = "";

    const inspect = () => {
      const frame = iframeRef.current;
      if (!frame) return;
      const text = narrationTextFromFrame(frame);
      if (!text || text === lastDelivered) return;
      if (text !== lastCandidate) {
        lastCandidate = text;
        candidateSince = Date.now();
        return;
      }
      // Wait for animations/layers to settle before narrating the completed slide.
      if (Date.now() - candidateSince < 700) return;
      lastDelivered = text;
      onVisibleTextChangeRef.current?.(text);
    };

    const timer = window.setInterval(inspect, 400);
    return () => window.clearInterval(timer);
  }, [onVisibleTextChange, ready, runtimeReady]);

  useEffect(() => {
    if (preview) {
      dataRef.current = {};
      setReady(true);
      return;
    }
    if (!code) {
      setError("Open this course using your claimed enrollment code.");
      return;
    }

    let active = true;
    fetch(`/api/scorm/${encodeURIComponent(slug)}/progress?code=${encodeURIComponent(code)}`)
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Course progress could not be loaded.");
        if (!active) return;
        dataRef.current = Object.fromEntries(
          Object.entries(payload.data || {}).map(([key, value]) => [key, String(value ?? "")]),
        );
        setCertificateUrl(payload.certificateUrl || "");
        setReady(true);
      })
      .catch((reason) => active && setError(reason instanceof Error ? reason.message : "Course could not be opened."));
    return () => { active = false; };
  }, [code, preview, slug]);

  useEffect(() => {
    if (!ready) return;
    let lastError = "0";
    let saving = false;
    let saveAgain = false;

    const save = async () => {
      if (preview) return;
      if (saving) {
        saveAgain = true;
        return;
      }
      saving = true;
      try {
        const response = await fetch(`/api/scorm/${encodeURIComponent(slug)}/progress`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, data: dataRef.current }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Progress could not be saved.");
        if (payload.certificateUrl) setCertificateUrl(payload.certificateUrl);
        lastError = "0";
      } catch (reason) {
        lastError = "101";
        setError(reason instanceof Error ? reason.message : "Progress could not be saved.");
      } finally {
        saving = false;
        if (saveAgain) {
          saveAgain = false;
          void save();
        }
      }
    };

    const getValue = (key: string) => {
      lastError = "0";
      if (key in dataRef.current) return dataRef.current[key];
      if (key === "cmi.core.lesson_status") return "not attempted";
      if (key === "cmi.completion_status" || key === "cmi.success_status") return "unknown";
      return "";
    };
    const setValue = (key: string, value: unknown) => {
      const next = String(value ?? "");
      dataRef.current[key] = next;
      lastError = "0";
      onRuntimeChangeRef.current?.({
        key,
        value: next,
        snapshot: { ...dataRef.current },
      });
      return "true";
    };
    const initialize = () => { lastError = "0"; return "true"; };
    const commit = () => { void save(); return "true"; };
    const finish = () => { void save(); return "true"; };
    const getErrorString = (codeValue: string) => codeValue === "0" ? "No error" : "General exception";

    const api12 = {
      LMSInitialize: initialize,
      LMSFinish: finish,
      LMSGetValue: getValue,
      LMSSetValue: setValue,
      LMSCommit: commit,
      LMSGetLastError: () => lastError,
      LMSGetErrorString: getErrorString,
      LMSGetDiagnostic: getErrorString,
    };
    const api2004 = {
      Initialize: initialize,
      Terminate: finish,
      GetValue: getValue,
      SetValue: setValue,
      Commit: commit,
      GetLastError: () => lastError,
      GetErrorString: getErrorString,
      GetDiagnostic: getErrorString,
    };
    const runtimeWindow = window as unknown as { API?: typeof api12; API_1484_11?: typeof api2004 };
    runtimeWindow.API = api12;
    runtimeWindow.API_1484_11 = api2004;
    setRuntimeReady(true);

    const onPageHide = () => {
      navigator.sendBeacon(
        `/api/scorm/${encodeURIComponent(slug)}/progress`,
        new Blob([JSON.stringify({ code, data: dataRef.current })], { type: "application/json" }),
      );
    };
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      void save();
      delete runtimeWindow.API;
      delete runtimeWindow.API_1484_11;
    };
  }, [code, preview, ready, slug]);

  const launchUrl = `/api/scorm/${encodeURIComponent(slug)}/asset/${entryPoint.split("/").map(encodeURIComponent).join("/")}`;

  const iframe = (
    <iframe
      ref={iframeRef}
      title={title}
      src={launchUrl}
      className={embedded ? `h-full w-full border-0 bg-white ${className || ""}` : "h-[calc(100vh-77px)] w-full border-0 bg-white"}
      allow="autoplay; fullscreen"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads allow-modals"
    />
  );

  if (embedded) {
    return (
      <div className={`relative h-full min-h-0 bg-white ${className || ""}`}>
        {error ? (
          <p className="absolute inset-x-0 top-0 z-10 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
            {error}
          </p>
        ) : null}
        {!ready || !runtimeReady ? (
          <div className="grid h-full min-h-[320px] place-items-center">
            <LoaderCircle className="animate-spin text-[#c68b1b]" size={34} />
          </div>
        ) : (
          iframe
        )}
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#0b1f33] text-white">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[#e8b84f]">
            SCORM {version}{preview ? " · Administrator preview" : ""}
          </p>
          <h1 className="mt-1 text-lg font-semibold">{title}</h1>
        </div>
        <div className="flex items-center gap-3">
          {!preview && certificateUrl && (
            <a href={certificateUrl} className="inline-flex items-center gap-2 rounded-full bg-[#d9a036] px-4 py-2 text-sm font-bold text-[#10283f]">
              <Award size={17} /> Certificate earned
            </a>
          )}
          <button type="button" onClick={() => iframeRef.current?.requestFullscreen()} className="inline-flex items-center gap-2 rounded-full border border-white/25 px-4 py-2 text-sm font-semibold">
            <Maximize2 size={16} /> Full screen
          </button>
        </div>
      </header>
      {error && <p className="border-b border-amber-300/30 bg-amber-400/10 px-5 py-3 text-sm text-amber-100">{error}</p>}
      {!ready || !runtimeReady ? (
        <div className="grid min-h-[75vh] place-items-center"><LoaderCircle className="animate-spin text-[#e8b84f]" size={34} /></div>
      ) : (
        iframe
      )}
    </main>
  );
}
