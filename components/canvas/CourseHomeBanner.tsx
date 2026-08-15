"use client";

import { useCallback, useEffect, useState } from "react";
import { HOME_EMBED_TITLE } from "@/lib/canvas/home-embed-constants";
import { buildWelcomeMessage, getStudentDisplayName } from "@/lib/canvas/home-embed-messages";

type TeacherMessage = {
  id: number;
  message: string;
};

type AutoAlert = {
  id: string;
  title: string;
  message: string;
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

  const alertLines: string[] = [];
  for (const message of teacherMessages) {
    if (message.message?.trim()) alertLines.push(message.message.trim());
  }
  for (const alert of autoAlerts.slice(0, 3)) {
    alertLines.push(`${alert.title}: ${alert.message}`);
  }

  const isWelcome = alertLines.length === 0;
  const lines = isWelcome ? [buildWelcomeMessage(displayName)] : alertLines;

  return (
    <section
      className={`course-home-banner ${isWelcome ? "course-home-banner-welcome" : "course-home-banner-alert"}`}
      aria-labelledby="course-home-alerts-title"
    >
      <h2 id="course-home-alerts-title" className="course-home-banner-title">
        {HOME_EMBED_TITLE}
      </h2>
      {lines.map((line, index) => (
        <p key={`${index}-${line}`} className="course-home-banner-message">
          {line}
        </p>
      ))}
    </section>
  );
}
