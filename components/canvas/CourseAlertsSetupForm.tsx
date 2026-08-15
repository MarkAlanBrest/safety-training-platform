"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type Config = {
  missingWorkDays: number;
  lowGradeThreshold: number;
  bannerMessage: string | null;
  showMissing: boolean;
  showLowGrades: boolean;
  courseName: string | null;
};

export function CourseAlertsSetupForm() {
  const searchParams = useSearchParams();
  const courseId = (searchParams.get("course") || searchParams.get("courseId") || "").trim();

  const [missingWorkDays, setMissingWorkDays] = useState(14);
  const [lowGradeThreshold, setLowGradeThreshold] = useState(70);
  const [bannerMessage, setBannerMessage] = useState("");
  const [showMissing, setShowMissing] = useState(true);
  const [showLowGrades, setShowLowGrades] = useState(true);
  const [courseName, setCourseName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [cleaning, setCleaning] = useState(false);

  useEffect(() => {
    if (!courseId) return;
    void (async () => {
      const response = await fetch(`/api/course-alerts/config?courseId=${encodeURIComponent(courseId)}`);
      const data = await response.json();
      if (!response.ok) return;
      const config = data.config as Config;
      setMissingWorkDays(config.missingWorkDays);
      setLowGradeThreshold(config.lowGradeThreshold);
      setBannerMessage(config.bannerMessage || "");
      setShowMissing(config.showMissing);
      setShowLowGrades(config.showLowGrades);
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
          bannerMessage,
          showMissing,
          showLowGrades,
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
        Save once. Students see a bold reminder at the top of Home automatically — no module
        click required. Your existing home page content stays below. The bar hides when there is
        nothing to communicate.
      </p>

      <form className="course-alerts-setup-form" onSubmit={handleSubmit}>
        <label>
          Course name (optional)
          <input value={courseName} onChange={(event) => setCourseName(event.target.value)} />
        </label>

        <label>
          Days back to check for missing work
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
          Grade % before low-grade warning
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
          Optional message for all students (leave blank to only show missing work / low grades)
          <textarea
            value={bannerMessage}
            onChange={(event) => setBannerMessage(event.target.value)}
            rows={4}
            placeholder="e.g. Check your missing assignments this week."
          />
        </label>

        <label className="course-alerts-setup-check">
          <input
            type="checkbox"
            checked={showMissing}
            onChange={(event) => setShowMissing(event.target.checked)}
          />
          Show missing assignment warnings in popup
        </label>

        <label className="course-alerts-setup-check">
          <input
            type="checkbox"
            checked={showLowGrades}
            onChange={(event) => setShowLowGrades(event.target.checked)}
          />
          Show low grade warnings in popup
        </label>

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
