"use client";

import { useCallback, useEffect, useState } from "react";
import { HOME_EMBED_TITLE } from "@/lib/canvas/home-embed-constants";
import { buildWelcomeMessage, getStudentDisplayName } from "@/lib/canvas/home-embed-messages";

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
  studentName?: string;
  handoffToken?: string | null;
};

export function CourseHomeBanner({
  courseId,
  studentName = "Student",
  handoffToken = null,
}: Props) {
  const [displayName, setDisplayName] = useState(() => getStudentDisplayName(studentName));
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
    setTeacherMessages(data.teacherMessages || []);
    setAutoAlerts(data.alerts || []);
  }, [courseId, handoffToken]);

  useEffect(() => {
    document.documentElement.classList.add("course-alerts-embed-root");
    document.body.classList.add("course-alerts-embed-root");
    void fetch("/api/course-alerts/refresh-embed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId }),
    });
    void loadAlerts();
    const timer = window.setInterval(() => {
      void loadAlerts();
    }, 60_000);
    return () => {
      window.clearInterval(timer);
      document.documentElement.classList.remove("course-alerts-embed-root");
      document.body.classList.remove("course-alerts-embed-root");
    };
  }, [courseId, loadAlerts]);

  const hasAlerts = teacherMessages.length > 0 || autoAlerts.length > 0;

  return (
    <section
      className={`course-home-banner ${hasAlerts ? "course-home-banner-alert" : "course-home-banner-welcome"}`}
      aria-labelledby="course-home-alerts-title"
    >
      <h2 id="course-home-alerts-title" className="course-home-banner-title">
        {HOME_EMBED_TITLE}
      </h2>
      {hasAlerts ? (
        <>
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
        </>
      ) : (
        <p className="course-home-banner-message">{buildWelcomeMessage(displayName)}</p>
      )}
    </section>
  );
}
