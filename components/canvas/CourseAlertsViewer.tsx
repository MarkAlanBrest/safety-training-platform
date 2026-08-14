"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRing, ShieldAlert } from "lucide-react";

type AlertMessage = {
  id: number;
  message: string;
  createdAt: string;
};

type Props = {
  courseId: string;
  initialCourseName?: string | null;
};

export function CourseAlertsViewer({ courseId, initialCourseName = null }: Props) {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [studentName, setStudentName] = useState("");
  const [courseName, setCourseName] = useState<string | null>(initialCourseName);
  const [messages, setMessages] = useState<AlertMessage[]>([]);
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
      const response = await fetch(
        `/api/course-alerts/messages?course=${encodeURIComponent(courseId)}`,
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not load alerts.");
      }
      setStudentName(data.studentName || "Student");
      setCourseName(data.courseName || null);
      setMessages(data.messages || []);
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

        {error ? <p className="course-alerts-error">{error}</p> : null}

        {messages.length ? (
          messages.map((alert) => (
            <div key={alert.id} className="course-alerts-banner" role="alert">
              <strong>Alert for {studentName}</strong>
              <p>{alert.message}</p>
            </div>
          ))
        ) : (
          <p className="course-alerts-quiet">No alerts right now. You&apos;re all caught up.</p>
        )}
      </div>
    </div>
  );
}
