"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRing, ShieldAlert } from "lucide-react";

type TeacherMessage = {
  id: number;
  message: string;
  createdAt: string;
};

type AutoAlert = {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  message: string;
  kind: string;
  link?: string;
};

type Props = {
  courseId: string;
  initialCourseName?: string | null;
};

export function CourseAlertsViewer({ courseId, initialCourseName = null }: Props) {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [studentName, setStudentName] = useState("");
  const [courseName, setCourseName] = useState<string | null>(initialCourseName);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [teacherMessages, setTeacherMessages] = useState<TeacherMessage[]>([]);
  const [autoAlerts, setAutoAlerts] = useState<AutoAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadStatus = useCallback(async () => {
    const response = await fetch("/api/canvas/status");
    const data = await response.json();
    setConnected(Boolean(data.connected));
    return Boolean(data.connected);
  }, []);

  const loadAlerts = useCallback(async () => {
    if (!courseId) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/course-alerts/feed?course=${encodeURIComponent(courseId)}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not load alerts.");
      }
      setStudentName(data.studentName || "Student");
      setCourseName(data.courseName || null);
      setBannerMessage(data.bannerMessage || data.config?.bannerMessage || null);
      setTeacherMessages(data.teacherMessages || []);
      setAutoAlerts(data.alerts || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load alerts.");
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    void (async () => {
      const isConnected = await loadStatus();
      if (isConnected) await loadAlerts();
    })();
  }, [loadAlerts, loadStatus]);

  useEffect(() => {
    if (!connected) return;
    const timer = window.setInterval(() => {
      void loadAlerts();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [connected, loadAlerts]);

  if (connected === null) {
    return <div className="course-alerts-loading">Loading alerts...</div>;
  }

  if (!connected) {
    return (
      <div className="course-alerts-shell">
        <div className="course-alerts-cta">
          <ShieldAlert size={36} />
          <h1>Open this from Canvas</h1>
          <p>Embed this tool on your course home page. Canvas will identify you automatically.</p>
        </div>
      </div>
    );
  }

  const hasAlerts = teacherMessages.length > 0 || autoAlerts.length > 0;

  return (
    <div className="course-alerts-shell">
      <div className="course-alerts-active">
        <div className="course-alerts-status">
          <BellRing size={20} />
          <span>
            {courseName ? `${courseName} · ` : ""}
            Hi {studentName.split(" ")[0] || studentName}
          </span>
          <button
            type="button"
            className="course-alerts-refresh"
            onClick={() => void loadAlerts()}
            disabled={loading}
          >
            Refresh
          </button>
        </div>

        {bannerMessage ? (
          <div className="course-alerts-banner course-alerts-banner-info" role="note">
            <strong>Reminder</strong>
            <p>{bannerMessage}</p>
          </div>
        ) : null}

        {error ? <p className="course-alerts-error">{error}</p> : null}

        {teacherMessages.map((alert) => (
          <div key={`teacher-${alert.id}`} className="course-alerts-banner" role="alert">
            <strong>Alert for {studentName}</strong>
            <p>{alert.message}</p>
          </div>
        ))}

        {autoAlerts.map((alert) => (
          <div
            key={alert.id}
            className={`course-alerts-banner course-alerts-banner-${alert.severity}`}
            role="alert"
          >
            <strong>{alert.title}</strong>
            <p>{alert.message}</p>
          </div>
        ))}

        {!hasAlerts && !bannerMessage ? (
          <p className="course-alerts-quiet">No alerts right now. You&apos;re all caught up.</p>
        ) : null}
      </div>
    </div>
  );
}
