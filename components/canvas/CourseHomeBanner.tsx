"use client";

import { useCallback, useEffect, useState } from "react";

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

type Props = {
  courseId: string;
  initialBannerMessage?: string | null;
  handoffToken?: string | null;
};

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
  }, [courseId, handoffToken, initialBannerMessage]);

  useEffect(() => {
    document.documentElement.classList.add("course-alerts-embed-root");
    document.body.classList.add("course-alerts-embed-root");
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

  useEffect(() => {
    try {
      if (window.frameElement instanceof HTMLIFrameElement) {
        window.frameElement.style.height = ready && lines.length ? "160px" : "1px";
      }
    } catch {
      // Cross-origin parent — ignore.
    }
  }, [ready, lines.length]);

  if (!ready) {
    return <div className="course-home-banner-empty" aria-hidden="true" />;
  }

  if (!lines.length) {
    return <div className="course-home-banner-empty" aria-hidden="true" />;
  }

  return (
    <div className="course-home-banner" role="alert">
      <strong>Reminder</strong>
      {lines.map((line, index) => (
        <p key={`${index}-${line}`}>{line}</p>
      ))}
    </div>
  );
}
