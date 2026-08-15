"use client";

import { useEffect } from "react";
import { publishEmbedHeight, watchEmbedHeight } from "@/lib/canvas/embed-resize";

export function CourseHomeBannerStatic() {
  useEffect(() => {
    document.documentElement.classList.add("course-alerts-embed-root");
    document.body.classList.add("course-alerts-embed-root");
    publishEmbedHeight(0);
    const stopWatching = watchEmbedHeight();
    return () => {
      stopWatching();
      document.documentElement.classList.remove("course-alerts-embed-root");
      document.body.classList.remove("course-alerts-embed-root");
    };
  }, []);

  return <div className="course-home-banner-empty" aria-hidden="true" />;
}
