"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import {
  HOME_EMBED_BANNER_HEIGHT_PX,
  HOME_EMBED_TITLE,
} from "@/lib/canvas/home-embed-constants";
import { buildWelcomeMessage, getStudentDisplayName } from "@/lib/canvas/home-embed-messages";

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
  studentName?: string;
  initialBannerMessage?: string | null;
  handoffToken?: string | null;
};

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

export function CourseHomeBanner({
  courseId,
  studentName = "Student",
  initialBannerMessage = null,
  handoffToken = null,
}: Props) {
  const [displayName, setDisplayName] = useState(() => getStudentDisplayName(studentName));
  const [bannerMessage, setBannerMessage] = useState<string | null>(initialBannerMessage);
  const [teacherMessages, setTeacherMessages] = useState<TeacherMessage[]>([]);
  const [autoAlerts, setAutoAlerts] = useState<AutoAlert[]>([]);

  const loadAlerts = useCallback(async () => {
    const handoffQuery = handoffToken ? `&handoff=${encodeURIComponent(handoffToken)}` : "";
    const response = await fetch(
      `/api/course-alerts/feed?course=${encodeURIComponent(courseId)}${handoffQuery}`,
      { credentials: "include" },
    );

    if (!response.ok) return;

    const data = await response.json();
    if (data.studentName) {
      setDisplayName(getStudentDisplayName(data.studentName));
    }
    setBannerMessage(data.bannerMessage || data.config?.bannerMessage || null);
    setTeacherMessages(data.teacherMessages || []);
    setAutoAlerts(data.alerts || []);
  }, [courseId, handoffToken]);

  useEffect(() => {
    document.documentElement.classList.add("course-alerts-embed-root");
    document.body.classList.add("course-alerts-embed-root");
    resizeEmbedFrame(HOME_EMBED_BANNER_HEIGHT_PX);
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

  const alertLines: string[] = [];
  if (bannerMessage?.trim()) alertLines.push(bannerMessage.trim());
  for (const message of teacherMessages) {
    if (message.message?.trim()) alertLines.push(message.message.trim());
  }
  for (const alert of autoAlerts.slice(0, 3)) {
    alertLines.push(`${alert.title}: ${alert.message}`);
  }

  const lines = alertLines.length ? alertLines : [buildWelcomeMessage(displayName)];

  useLayoutEffect(() => {
    resizeEmbedFrame(HOME_EMBED_BANNER_HEIGHT_PX);
  }, [lines.length]);

  return (
    <div className="course-home-embed-shell">
      <div className="course-home-banner-top-pixel" aria-hidden="true" />
      <section className="course-home-banner" aria-labelledby="course-home-alerts-title">
        <h2 id="course-home-alerts-title" className="course-home-banner-title">
          {HOME_EMBED_TITLE}
        </h2>
        {lines.map((line, index) => (
          <p key={`${index}-${line}`} className="course-home-banner-message">
            {line}
          </p>
        ))}
      </section>
    </div>
  );
}
