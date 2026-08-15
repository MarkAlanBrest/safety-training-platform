"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";

type TeacherMessage = {
  id: number;
  message: string;
};

type AutoAlert = {
  id: string;
  title: string;
  message: string;
  severity: "critical" | "warning" | "info";
};

// Temporary — remove after verifying the home embed is visible in Canvas.
const HOME_EMBED_TEST_MESSAGE = "Test: Student alerts are connected on your course home page.";

type Props = {
  courseId: string;
  initialBannerMessage?: string | null;
  handoffToken?: string | null;
};

function resizeEmbedFrame(heightPx: number) {
  try {
    if (window.frameElement instanceof HTMLIFrameElement) {
      window.frameElement.style.height = `${heightPx}px`;
      window.frameElement.style.background = "#fff";
      window.frameElement.style.border = "0";
      window.frameElement.style.boxShadow = "none";
    }
  } catch {
    // Cross-origin parent — ignore.
  }
}

export function CourseHomeBanner({
  courseId,
  initialBannerMessage = null,
  handoffToken = null,
}: Props) {
  const [bannerMessage, setBannerMessage] = useState<string | null>(initialBannerMessage);
  const [teacherMessages, setTeacherMessages] = useState<TeacherMessage[]>([]);
  const [autoAlerts, setAutoAlerts] = useState<AutoAlert[]>([]);
  const [ready, setReady] = useState(false);

  const loadAlerts = useCallback(async () => {
    const handoffQuery = handoffToken ? `&handoff=${encodeURIComponent(handoffToken)}` : "";
    const response = await fetch(
      `/api/course-alerts/feed?course=${encodeURIComponent(courseId)}${handoffQuery}`,
      { credentials: "include" },
    );

    if (response.ok) {
      const data = await response.json();
      setBannerMessage(data.bannerMessage || data.config?.bannerMessage || null);
      setTeacherMessages(data.teacherMessages || []);
      setAutoAlerts(data.alerts || []);
      setReady(true);
      return;
    }

    setBannerMessage(null);
    setTeacherMessages([]);
    setAutoAlerts([]);
    setReady(true);
  }, [courseId, handoffToken]);

  useEffect(() => {
    document.documentElement.classList.add("course-alerts-embed-root");
    document.body.classList.add("course-alerts-embed-root");
    resizeEmbedFrame(1);
    return () => {
      document.documentElement.classList.remove("course-alerts-embed-root");
      document.body.classList.remove("course-alerts-embed-root");
    };
  }, []);

  useEffect(() => {
    void loadAlerts();
    const timer = window.setInterval(() => {
      void loadAlerts();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [loadAlerts]);

  const lines: string[] = [];
  if (bannerMessage?.trim()) lines.push(bannerMessage.trim());
  for (const message of teacherMessages) {
    if (message.message?.trim()) lines.push(message.message.trim());
  }
  for (const alert of autoAlerts.slice(0, 3)) {
    lines.push(`${alert.title}: ${alert.message}`);
  }
  if (!lines.length) {
    lines.push(HOME_EMBED_TEST_MESSAGE);
  }

  const showBanner = ready && lines.length > 0;

  useLayoutEffect(() => {
    resizeEmbedFrame(showBanner ? 120 : 1);
  }, [showBanner, lines.length]);

  return (
    <div className="course-home-embed-shell">
      <div className="course-home-banner-top-pixel" aria-hidden="true" />
      {showBanner ? (
        <div className="course-home-banner" role="alert">
          <strong>Reminder</strong>
          {lines.map((line, index) => (
            <p key={`${index}-${line}`}>{line}</p>
          ))}
        </div>
      ) : (
        <div className="course-home-banner-empty" aria-hidden="true" />
      )}
    </div>
  );
}
