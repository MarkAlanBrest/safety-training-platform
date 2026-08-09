"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Award, LoaderCircle, Maximize2 } from "lucide-react";

type RuntimeData = Record<string, string>;

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
}: {
  title: string;
  slug: string;
  entryPoint: string;
  version: string;
  preview?: boolean;
  embedded?: boolean;
  className?: string;
  onRuntimeChange?: (change: ScormRuntimeChange) => void;
}) {
  const searchParams = useSearchParams();
  const code = searchParams?.get("code") || "";
  const dataRef = useRef<RuntimeData>({});
  const onRuntimeChangeRef = useRef(onRuntimeChange);
  const [ready, setReady] = useState(false);
  const [runtimeReady, setRuntimeReady] = useState(false);
  const [error, setError] = useState("");
  const [certificateUrl, setCertificateUrl] = useState("");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    onRuntimeChangeRef.current = onRuntimeChange;
  }, [onRuntimeChange]);

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
      className={
        embedded
          ? `absolute inset-0 h-full w-full border-0 bg-white ${className || ""}`
          : "h-[calc(100dvh-77px)] w-full border-0 bg-white"
      }
      allow="autoplay; fullscreen"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads allow-modals"
    />
  );

  if (embedded) {
    return (
      <div className={`relative h-full min-h-0 w-full overflow-hidden bg-white ${className || ""}`}>
        {error ? (
          <p className="absolute inset-x-0 top-0 z-10 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
            {error}
          </p>
        ) : null}
        {!ready || !runtimeReady ? (
          <div className="grid h-full place-items-center">
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
