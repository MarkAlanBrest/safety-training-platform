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
  const [bannerMessage, setBannerMessage] = useState("Check your missing work and grades below.");
  const [showMissing, setShowMissing] = useState(true);
  const [showLowGrades, setShowLowGrades] = useState(true);
  const [courseName, setCourseName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [themeSnippetUrl, setThemeSnippetUrl] = useState("");

  useEffect(() => {
    if (!courseId) return;
    void (async () => {
      const [configResponse, homeResponse] = await Promise.all([
        fetch(`/api/course-alerts/config?courseId=${encodeURIComponent(courseId)}`),
        fetch(`/api/course-alerts/home-status?courseId=${encodeURIComponent(courseId)}`),
      ]);

      const configData = await configResponse.json();
      if (configResponse.ok) {
        const config = configData.config as Config;
        setMissingWorkDays(config.missingWorkDays);
        setLowGradeThreshold(config.lowGradeThreshold);
        setBannerMessage(config.bannerMessage || "Check your missing work and grades below.");
        setShowMissing(config.showMissing);
        setShowLowGrades(config.showLowGrades);
        if (config.courseName) setCourseName(config.courseName);
      }

      const homeData = await homeResponse.json();
      if (homeResponse.ok && homeData.themeSnippetUrl) {
        setThemeSnippetUrl(homeData.themeSnippetUrl as string);
      }
    })();
  }, [courseId]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    const payload = {
      courseId,
      courseName: courseName.trim() || null,
      missingWorkDays,
      lowGradeThreshold,
      bannerMessage,
      showMissing,
      showLowGrades,
    };

    try {
      const response = await fetch("/api/course-alerts/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not save settings.");
      }

      if (data.homeEmbed?.themeSnippetUrl) {
        setThemeSnippetUrl(data.homeEmbed.themeSnippetUrl);
      }

      setSuccess(
        data.homeEmbed?.note ||
          "Settings saved. Add the one-time popup script below so students see a bold popup on the course home page.",
      );
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
        Save your bold popup message here. Your Canvas home page content is not changed.
      </p>

      <div className="course-alerts-manual-steps">
        <h2>Bold popup on course home (one-time setup)</h2>
        <ol>
          <li>Click <strong>Save settings</strong> below first.</li>
          <li>
            Open{" "}
            {themeSnippetUrl ? (
              <a href={themeSnippetUrl} target="_blank" rel="noreferrer">
                the popup script
              </a>
            ) : (
              "the popup script"
            )}{" "}
            and copy it.
          </li>
          <li>
            Canvas <strong>Admin</strong> → <strong>Themes</strong> → <strong>Edit</strong> →{" "}
            <strong>JavaScript</strong> → paste → <strong>Save</strong>
          </li>
          <li>Student View → <strong>Home</strong> → bold popup appears automatically.</li>
        </ol>
        <p className="course-alerts-quiet">
          Opening <strong>Student Alerts</strong> from Modules also shows the same style popup inside the tool.
        </p>
      </div>

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
          Popup message shown to students
          <textarea
            value={bannerMessage}
            onChange={(event) => setBannerMessage(event.target.value)}
            rows={4}
            required
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
      </form>
    </div>
  );
}
