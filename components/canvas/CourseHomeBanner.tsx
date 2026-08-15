"use client";

import { useCallback, useEffect, useState } from "react";
import { HOME_EMBED_TITLE } from "@/lib/canvas/home-embed-constants";
import { publishEmbedHeight, watchEmbedHeight } from "@/lib/canvas/embed-resize";

type TeacherMessage = {
  id: number;
  message: string;
};

type AlertItem = {
  name: string;
  url: string;
};

type AutoAlert = {
  id: string;
  title: string;
  message: string;
  items?: AlertItem[];
};

type Props = {
  courseId: string;
  handoffToken?: string | null;
};

export function CourseHomeBanner({
  courseId,
  handoffToken = null,
}: Props) {
  const [teacherMessages, setTeacherMessages] = useState<TeacherMessage[]>([]);
  const [autoAlerts, setAutoAlerts] = useState<AutoAlert[]>([]);
  const [loaded, setLoaded] = useState(false);

  const loadAlerts = useCallback(async () => {
    const handoffQuery = handoffToken ? `&handoff=${encodeURIComponent(handoffToken)}` : "";
    try {
      const response = await fetch(
        `/api/course-alerts/feed?course=${encodeURIComponent(courseId)}${handoffQuery}`,
        { credentials: "include" },
      );
      if (!response.ok) {
        setTeacherMessages([]);
        setAutoAlerts([]);
        return;
      }

      const data = await response.json();
      setTeacherMessages(data.teacherMessages || []);
      setAutoAlerts(data.alerts || []);
    } finally {
      setLoaded(true);
    }
  }, [courseId, handoffToken]);

  useEffect(() => {
    document.documentElement.classList.add("course-alerts-embed-root");
    document.body.classList.add("course-alerts-embed-root");
    void loadAlerts();
    const stopWatching = watchEmbedHeight();
    const timer = window.setInterval(() => {
      void loadAlerts();
    }, 60_000);
    return () => {
      window.clearInterval(timer);
      stopWatching();
      document.documentElement.classList.remove("course-alerts-embed-root");
      document.body.classList.remove("course-alerts-embed-root");
    };
  }, [courseId, loadAlerts]);

  const hasAlerts = teacherMessages.length > 0 || autoAlerts.length > 0;

  useEffect(() => {
    publishEmbedHeight(hasAlerts ? undefined : 0);
  }, [hasAlerts, autoAlerts, teacherMessages, loaded]);

  if (!loaded || !hasAlerts) {
    return <div className="course-home-banner-empty" aria-hidden="true" />;
  }

  return (
    <section className="course-home-banner course-home-banner-alert">
      <h2 className="course-home-banner-title">{HOME_EMBED_TITLE}</h2>
      {teacherMessages.map((message) => (
        <p key={message.id} className="course-home-banner-message">
          {message.message}
        </p>
      ))}
      {autoAlerts.slice(0, 4).map((alert) => (
        <div key={alert.id} className="course-home-banner-alert-block">
          <p className="course-home-banner-message">{alert.message}</p>
          {alert.items?.length ? (
            <p className="course-home-banner-links">
              {alert.items.map((item, index) => (
                <span key={`${alert.id}-${item.url}`}>
                  {index > 0 ? " · " : null}
                  <a href={item.url} target="_top" rel="noreferrer">
                    {item.name}
                  </a>
                </span>
              ))}
            </p>
          ) : null}
        </div>
      ))}
    </section>
  );
}
