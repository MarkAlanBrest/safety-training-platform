"use client";

import { useEffect } from "react";
import { HOME_EMBED_BANNER_HEIGHT_PX } from "@/lib/canvas/home-embed-constants";

function resizeEmbedFrame(heightPx: number) {
  try {
    if (window.frameElement instanceof HTMLIFrameElement) {
      window.frameElement.style.height = `${heightPx}px`;
      window.frameElement.style.minHeight = `${heightPx}px`;
      window.frameElement.style.background = "#fff";
      window.frameElement.style.border = "0";
      window.frameElement.style.boxShadow = "none";
      window.frameElement.style.outline = "0";
    }
  } catch {
    // Cross-origin parent — ignore.
  }
}

export function CourseHomeEmbedResizer() {
  useEffect(() => {
    document.documentElement.classList.add("course-alerts-embed-root");
    document.body.classList.add("course-alerts-embed-root");
    resizeEmbedFrame(HOME_EMBED_BANNER_HEIGHT_PX);
    return () => {
      document.documentElement.classList.remove("course-alerts-embed-root");
      document.body.classList.remove("course-alerts-embed-root");
    };
  }, []);

  return null;
}
