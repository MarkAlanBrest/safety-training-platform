"use client";

import { useEffect, useRef, useState } from "react";
import type { WebViewerInstance } from "@pdftron/webviewer";

export default function AprysePptxTestViewer() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<WebViewerInstance | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let cancelled = false;

    void import("@pdftron/webviewer")
      .then(({ default: WebViewer }) =>
        WebViewer(
          {
            path: "/apryse",
            fullAPI: true,
          },
          mount,
        ),
      )
      .then((instance) => {
        if (cancelled) return;
        instanceRef.current = instance;
        instance.UI.disableFeatures([
          instance.UI.Feature.Download,
          instance.UI.Feature.FilePicker,
          instance.UI.Feature.Print,
        ]);
        setReady(true);
        setLoading(false);
      })
      .catch((viewerError: unknown) => {
        if (cancelled) return;
        console.error(viewerError);
        setError("The Apryse test viewer could not start.");
        setLoading(false);
      });

    return () => {
      cancelled = true;
      instanceRef.current?.UI.dispose();
      instanceRef.current = null;
    };
  }, []);

  async function openPowerPoint(file: File | null) {
    if (!file || !instanceRef.current) return;
    setError("");
    setLoading(true);
    try {
      await instanceRef.current.UI.loadDocument(file, {
        filename: file.name,
        extension: "pptx",
      });
    } catch (loadError) {
      console.error(loadError);
      setError("This PowerPoint could not be opened by the test viewer.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#10283f]/10 bg-white p-5">
        <label className="block text-sm font-semibold text-[#10283f]" htmlFor="apryse-pptx">
          Choose a PowerPoint to compare
        </label>
        <input
          id="apryse-pptx"
          className="mt-3 block w-full text-sm text-[#69757e]"
          type="file"
          accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
          disabled={!ready}
          onChange={(event) => void openPowerPoint(event.target.files?.[0] || null)}
        />
        <p className="mt-2 text-xs text-[#69757e]">
          This test stays separate from course creation and does not upload or save the file.
        </p>
        {loading ? <p className="mt-3 text-sm text-[#a06e16]">Loading viewer…</p> : null}
        {error ? <p className="mt-3 text-sm font-medium text-red-700">{error}</p> : null}
      </div>

      <div
        ref={mountRef}
        className="h-[72vh] min-h-[560px] overflow-hidden rounded-2xl border border-[#10283f]/15 bg-[#0b1524]"
      />
    </div>
  );
}
