"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BellRing, Megaphone } from "lucide-react";

type AlertMessage = {
  id: number;
  message: string;
  createdAt: string;
};

type Props = {
  courseId: string;
  courseName?: string;
};

function storageKey(courseId: string) {
  return `course-alerts:${courseId}`;
}

export function CourseAlertsSignup({ courseId, courseName }: Props) {
  const [studentName, setStudentName] = useState("");
  const [draftName, setDraftName] = useState("");
  const [signedUp, setSignedUp] = useState(false);
  const [messages, setMessages] = useState<AlertMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showSignup, setShowSignup] = useState(false);

  const loadAlerts = useCallback(
    async (name: string) => {
      if (!courseId || !name) return;
      setLoading(true);
      setError("");
      try {
        const response = await fetch(
          `/api/course-alerts/messages?courseId=${encodeURIComponent(courseId)}&name=${encodeURIComponent(name)}`,
        );
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Could not load alerts.");
        }
        setSignedUp(Boolean(data.signedUp));
        setStudentName(data.studentName || name);
        setMessages(data.messages || []);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Could not load alerts.");
      } finally {
        setLoading(false);
      }
    },
    [courseId],
  );

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey(courseId));
    if (saved) {
      setStudentName(saved);
      setDraftName(saved);
      void loadAlerts(saved);
    }
  }, [courseId, loadAlerts]);

  async function handleSignup(event: React.FormEvent) {
    event.preventDefault();
    const name = draftName.trim();
    if (!name) return;

    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/course-alerts/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          courseName,
          studentName: name,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not sign up.");
      }

      window.localStorage.setItem(storageKey(courseId), name);
      setStudentName(name);
      setSignedUp(true);
      setShowSignup(false);
      await loadAlerts(name);
    } catch (signupError) {
      setError(signupError instanceof Error ? signupError.message : "Could not sign up.");
    } finally {
      setLoading(false);
    }
  }

  const headline = useMemo(() => {
    if (!signedUp) return "Get course alerts on this page.";
    if (!messages.length) return `You're signed up, ${studentName.split(" ")[0]}. No alerts right now.`;
    return `${messages.length} alert${messages.length === 1 ? "" : "s"} for ${studentName}`;
  }, [messages.length, signedUp, studentName]);

  return (
    <div className="course-alerts-shell">
      {!signedUp && !showSignup ? (
        <div className="course-alerts-cta">
          <p className="course-alerts-eyebrow">{courseName || "Course alerts"}</p>
          <h1>Want a bold reminder when your teacher sends one?</h1>
          <button type="button" className="course-alerts-signup-btn" onClick={() => setShowSignup(true)}>
            <Megaphone size={22} />
            Sign up for alerts
          </button>
        </div>
      ) : null}

      {showSignup && !signedUp ? (
        <form className="course-alerts-form" onSubmit={handleSignup}>
          <h2>Sign up for alerts</h2>
          <p>Enter your name exactly how your teacher knows you in this course.</p>
          <input
            type="text"
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            placeholder="Your full name"
            required
            autoFocus
          />
          {error ? <p className="course-alerts-error">{error}</p> : null}
          <button type="submit" className="course-alerts-signup-btn" disabled={loading}>
            {loading ? "Saving..." : "Start watching for alerts"}
          </button>
        </form>
      ) : null}

      {signedUp ? (
        <div className="course-alerts-active">
          <div className="course-alerts-status">
            <BellRing size={20} />
            <span>{headline}</span>
            <button
              type="button"
              className="course-alerts-refresh"
              onClick={() => void loadAlerts(studentName)}
              disabled={loading}
            >
              Refresh
            </button>
          </div>

          {messages.map((alert) => (
            <div key={alert.id} className="course-alerts-banner" role="alert">
              <strong>Alert for {studentName}</strong>
              <p>{alert.message}</p>
            </div>
          ))}

          {!messages.length && signedUp ? (
            <p className="course-alerts-quiet">You're all caught up. Check back after your teacher sends an alert.</p>
          ) : null}
        </div>
      ) : null}

      {error && signedUp ? <p className="course-alerts-error">{error}</p> : null}
    </div>
  );
}
