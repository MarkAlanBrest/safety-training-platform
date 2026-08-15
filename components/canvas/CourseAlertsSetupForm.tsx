"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DEFAULT_ALERT_MESSAGES } from "@/lib/course-alerts/messages";

type Config = {
  missingWorkDays: number;
  lowGradeThreshold: number;
  assignmentLowGradePercent: number;
  loginInactivityDays: number;
  dueSoonHours: number;
  missingMessage: string | null;
  assignmentLowGradeMessage: string | null;
  loginInactivityMessage: string | null;
  overallLowGradeMessage: string | null;
  dueSoonMessage: string | null;
  showMissing: boolean;
  showLowGrades: boolean;
  showAssignmentLowGrades: boolean;
  showLoginInactivity: boolean;
  showDueSoon: boolean;
  courseName: string | null;
};

export function CourseAlertsSetupForm() {
  const searchParams = useSearchParams();
  const courseId = (searchParams.get("course") || searchParams.get("courseId") || "").trim();

  const [missingWorkDays, setMissingWorkDays] = useState(14);
  const [lowGradeThreshold, setLowGradeThreshold] = useState(70);
  const [assignmentLowGradePercent, setAssignmentLowGradePercent] = useState(60);
  const [loginInactivityDays, setLoginInactivityDays] = useState(6);
  const [dueSoonHours, setDueSoonHours] = useState(6);
  const [missingMessage, setMissingMessage] = useState(DEFAULT_ALERT_MESSAGES.missing);
  const [assignmentLowGradeMessage, setAssignmentLowGradeMessage] = useState(
    DEFAULT_ALERT_MESSAGES.assignmentLowGrade,
  );
  const [loginInactivityMessage, setLoginInactivityMessage] = useState(
    DEFAULT_ALERT_MESSAGES.loginInactivity,
  );
  const [overallLowGradeMessage, setOverallLowGradeMessage] = useState(
    DEFAULT_ALERT_MESSAGES.overallLowGrade,
  );
  const [dueSoonMessage, setDueSoonMessage] = useState(DEFAULT_ALERT_MESSAGES.dueSoon);
  const [showMissing, setShowMissing] = useState(true);
  const [showLowGrades, setShowLowGrades] = useState(true);
  const [showAssignmentLowGrades, setShowAssignmentLowGrades] = useState(true);
  const [showLoginInactivity, setShowLoginInactivity] = useState(true);
  const [showDueSoon, setShowDueSoon] = useState(true);
  const [courseName, setCourseName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [cleaning, setCleaning] = useState(false);

  useEffect(() => {
    if (!courseId) return;
    void (async () => {
      await fetch("/api/course-alerts/refresh-embed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId }),
      });

      const response = await fetch(`/api/course-alerts/config?courseId=${encodeURIComponent(courseId)}`);
      const data = await response.json();
      if (!response.ok) return;
      const config = data.config as Config;
      setMissingWorkDays(config.missingWorkDays);
      setLowGradeThreshold(config.lowGradeThreshold);
      setAssignmentLowGradePercent(config.assignmentLowGradePercent ?? 60);
      setLoginInactivityDays(config.loginInactivityDays ?? 6);
      setDueSoonHours(config.dueSoonHours ?? 6);
      setMissingMessage(config.missingMessage || DEFAULT_ALERT_MESSAGES.missing);
      setAssignmentLowGradeMessage(
        config.assignmentLowGradeMessage || DEFAULT_ALERT_MESSAGES.assignmentLowGrade,
      );
      setLoginInactivityMessage(config.loginInactivityMessage || DEFAULT_ALERT_MESSAGES.loginInactivity);
      setOverallLowGradeMessage(config.overallLowGradeMessage || DEFAULT_ALERT_MESSAGES.overallLowGrade);
      setDueSoonMessage(config.dueSoonMessage || DEFAULT_ALERT_MESSAGES.dueSoon);
      setShowMissing(config.showMissing);
      setShowLowGrades(config.showLowGrades);
      setShowAssignmentLowGrades(config.showAssignmentLowGrades !== false);
      setShowLoginInactivity(config.showLoginInactivity !== false);
      setShowDueSoon(config.showDueSoon !== false);
      if (config.courseName) setCourseName(config.courseName);
    })();
  }, [courseId]);

  async function handleRemoveEmbed() {
    setCleaning(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/course-alerts/remove-home-embed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not remove the home page embed.");
      }
      setSuccess("Removed all alert embeds from the front page. Your home page content is restored.");
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Could not remove embed.");
    } finally {
      setCleaning(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/course-alerts/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          courseName: courseName.trim() || null,
          missingWorkDays,
          lowGradeThreshold,
          assignmentLowGradePercent,
          loginInactivityDays,
          dueSoonHours,
          missingMessage,
          assignmentLowGradeMessage,
          loginInactivityMessage,
          overallLowGradeMessage,
          dueSoonMessage,
          showMissing,
          showLowGrades,
          showAssignmentLowGrades,
          showLoginInactivity,
          showDueSoon,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not save settings.");
      }

      setSuccess(
        data.homeEmbed?.ok
          ? data.homeEmbed.note ||
              "Settings saved. Students will see reminders automatically when they open Home."
          : "Settings saved, but the home page embed could not be updated. See the error below.",
      );
      if (data.homeEmbed?.reason) {
        setError(data.homeEmbed.reason);
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not save settings.");
    } finally {
      setLoading(false);
    }
  }

  if (!courseId) {
    return (
      <div className="course-alerts-shell">
        <h1>Course alert setup</h1>
        <p>Open this page from Canvas while adding the external tool to your course.</p>
      </div>
    );
  }

  return (
    <div className="course-alerts-shell course-alerts-setup">
      <h1>Course alert settings</h1>
      <p className="course-alerts-setup-lead">
        Customize what students see on Home. Use {"{name}"}, {"{days}"}, {"{hours}"}, {"{assignments}"},
        {"{score}"}, and {"{threshold}"} in the message text. Save once — students do not click
        anything.
      </p>

      <form className="course-alerts-setup-form" onSubmit={handleSubmit}>
        <label>
          Course name (optional)
          <input value={courseName} onChange={(event) => setCourseName(event.target.value)} />
        </label>

        <fieldset className="course-alerts-setup-block">
          <legend>Missing assignments</legend>
          <label className="course-alerts-setup-check">
            <input
              type="checkbox"
              checked={showMissing}
              onChange={(event) => setShowMissing(event.target.checked)}
            />
            Turn on this alert
          </label>
          <label>
            Look back this many days
            <input
              type="number"
              min={1}
              max={90}
              value={missingWorkDays}
              onChange={(event) => setMissingWorkDays(Number(event.target.value))}
              required
            />
          </label>
          <label>
            Message
            <textarea
              value={missingMessage}
              onChange={(event) => setMissingMessage(event.target.value)}
              rows={3}
            />
          </label>
        </fieldset>

        <fieldset className="course-alerts-setup-block">
          <legend>Low grades on assignments (including zeros)</legend>
          <label className="course-alerts-setup-check">
            <input
              type="checkbox"
              checked={showAssignmentLowGrades}
              onChange={(event) => setShowAssignmentLowGrades(event.target.checked)}
            />
            Turn on this alert
          </label>
          <label>
            Flag an assignment if the score is 0 or below this percent
            <input
              type="number"
              min={0}
              max={100}
              value={assignmentLowGradePercent}
              onChange={(event) => setAssignmentLowGradePercent(Number(event.target.value))}
              required
            />
          </label>
          <label>
            Message
            <textarea
              value={assignmentLowGradeMessage}
              onChange={(event) => setAssignmentLowGradeMessage(event.target.value)}
              rows={3}
            />
          </label>
        </fieldset>

        <fieldset className="course-alerts-setup-block">
          <legend>Overall course grade</legend>
          <label className="course-alerts-setup-check">
            <input
              type="checkbox"
              checked={showLowGrades}
              onChange={(event) => setShowLowGrades(event.target.checked)}
            />
            Turn on this alert
          </label>
          <label>
            Alert if overall grade falls below this percent
            <input
              type="number"
              min={0}
              max={100}
              value={lowGradeThreshold}
              onChange={(event) => setLowGradeThreshold(Number(event.target.value))}
              required
            />
          </label>
          <label>
            Message
            <textarea
              value={overallLowGradeMessage}
              onChange={(event) => setOverallLowGradeMessage(event.target.value)}
              rows={3}
            />
          </label>
        </fieldset>

        <fieldset className="course-alerts-setup-block">
          <legend>Login / activity</legend>
          <label className="course-alerts-setup-check">
            <input
              type="checkbox"
              checked={showLoginInactivity}
              onChange={(event) => setShowLoginInactivity(event.target.checked)}
            />
            Turn on this alert
          </label>
          <label>
            Days without activity before alerting
            <input
              type="number"
              min={1}
              max={90}
              value={loginInactivityDays}
              onChange={(event) => setLoginInactivityDays(Number(event.target.value))}
              required
            />
          </label>
          <label>
            Message
            <textarea
              value={loginInactivityMessage}
              onChange={(event) => setLoginInactivityMessage(event.target.value)}
              rows={3}
            />
          </label>
        </fieldset>

        <fieldset className="course-alerts-setup-block">
          <legend>Due soon</legend>
          <label className="course-alerts-setup-check">
            <input
              type="checkbox"
              checked={showDueSoon}
              onChange={(event) => setShowDueSoon(event.target.checked)}
            />
            Turn on this alert
          </label>
          <label>
            Hours before the due time (not days)
            <input
              type="number"
              min={1}
              max={168}
              value={dueSoonHours}
              onChange={(event) => setDueSoonHours(Number(event.target.value))}
              required
            />
          </label>
          <label>
            Message
            <textarea
              value={dueSoonMessage}
              onChange={(event) => setDueSoonMessage(event.target.value)}
              rows={3}
            />
          </label>
        </fieldset>

        {error ? <p className="course-alerts-error">{error}</p> : null}
        {success ? <p className="course-alerts-success">{success}</p> : null}

        <button type="submit" disabled={loading}>
          {loading ? "Saving..." : "Save settings"}
        </button>

        <button
          type="button"
          className="course-alerts-remove-embed"
          disabled={cleaning}
          onClick={() => void handleRemoveEmbed()}
        >
          {cleaning ? "Removing..." : "Remove home page embed"}
        </button>
      </form>
    </div>
  );
}
