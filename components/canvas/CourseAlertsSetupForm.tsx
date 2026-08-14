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
  const importMode = searchParams.get("mode") === "import";

  const [missingWorkDays, setMissingWorkDays] = useState(14);
  const [lowGradeThreshold, setLowGradeThreshold] = useState(70);
  const [bannerMessage, setBannerMessage] = useState("Check your missing work and grades below.");
  const [showMissing, setShowMissing] = useState(true);
  const [showLowGrades, setShowLowGrades] = useState(true);
  const [courseName, setCourseName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!courseId) return;
    void (async () => {
      const response = await fetch(`/api/course-alerts/config?courseId=${encodeURIComponent(courseId)}`);
      const data = await response.json();
      if (!response.ok) return;
      const config = data.config as Config;
      setMissingWorkDays(config.missingWorkDays);
      setLowGradeThreshold(config.lowGradeThreshold);
      setBannerMessage(config.bannerMessage || "Check your missing work and grades below.");
      setShowMissing(config.showMissing);
      setShowLowGrades(config.showLowGrades);
      if (config.courseName) setCourseName(config.courseName);
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
      const endpoint = importMode ? "/api/lti/deep-link/finish" : "/api/course-alerts/config";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("text/html")) {
        const html = await response.text();
        document.open();
        document.write(html);
        document.close();
        return;
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not save settings.");
      }

      if (data.warning) {
        setSuccess(data.warning);
      } else if (importMode && data.imported !== false) {
        setSuccess("Student Alerts was added to your course with these settings.");
      } else {
        setSuccess("Alert settings saved for this course.");
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
      <h1>{importMode ? "Set up Student Alerts" : "Course alert settings"}</h1>
      <p className="course-alerts-setup-lead">
        Choose what students should see when they open this tool on the course home page.
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
          Message shown to students
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
          Show missing assignment warnings
        </label>

        <label className="course-alerts-setup-check">
          <input
            type="checkbox"
            checked={showLowGrades}
            onChange={(event) => setShowLowGrades(event.target.checked)}
          />
          Show low grade warnings
        </label>

        {error ? <p className="course-alerts-error">{error}</p> : null}
        {success ? <p className="course-alerts-success">{success}</p> : null}

        <button type="submit" disabled={loading}>
          {loading ? "Saving..." : importMode ? "Add to course with these settings" : "Save settings"}
        </button>
      </form>
    </div>
  );
}
