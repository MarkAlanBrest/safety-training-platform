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

type CanvasApiStatus = {
  ready: boolean;
  missing: string[];
  baseUrl: string | null;
};

function isServerConfigError(reason: string) {
  return (
    reason.includes("CANVAS_BASE_URL") ||
    reason.includes("CANVAS_API_TOKEN") ||
    reason.includes("Environment Variables")
  );
}

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
  const [showManualSteps, setShowManualSteps] = useState(false);
  const [canvasApi, setCanvasApi] = useState<CanvasApiStatus | null>(null);
  const [manualHtml, setManualHtml] = useState("");
  const [courseAccessError, setCourseAccessError] = useState("");

  useEffect(() => {
    if (!courseId) return;
    void (async () => {
      const [configResponse, homeResponse, htmlResponse] = await Promise.all([
        fetch(`/api/course-alerts/config?courseId=${encodeURIComponent(courseId)}`),
        fetch(`/api/course-alerts/home-status?courseId=${encodeURIComponent(courseId)}`),
        fetch(`/api/course-alerts/home-page-html?courseId=${encodeURIComponent(courseId)}`),
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
        if (configData.canvasApi) setCanvasApi(configData.canvasApi as CanvasApiStatus);
      }

      const homeData = await homeResponse.json();
      if (!homeResponse.ok || homeData.courseAccess === false) {
        setCourseAccessError(homeData.error || homeData.reason || "Canvas API cannot access this course.");
        setShowManualSteps(true);
      }

      const htmlData = await htmlResponse.json();
      if (htmlResponse.ok && htmlData.html) {
        setManualHtml(htmlData.html as string);
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

      if (data.canvasApi) setCanvasApi(data.canvasApi as CanvasApiStatus);

      if (data.homeEmbed?.ok) {
        if (data.homeEmbed.verified === false) {
          setSuccess("Alert settings saved for this course.");
          setError(
            "Canvas accepted the update but the home page may not be set correctly. Check Student View → Home, or use the manual paste below.",
          );
          setShowManualSteps(true);
        } else {
          setSuccess(
            "Settings saved. A test message was posted to the course home page — switch to Student View and open Home to check.",
          );
          setShowManualSteps(false);
        }
      } else if (data.homeEmbed?.reason) {
        if (isServerConfigError(data.homeEmbed.reason)) {
          setSuccess("Alert settings saved for this course.");
          setError(
            `Could not update the course home page: ${data.homeEmbed.reason} The home page will stay blank until this is fixed.`,
          );
          setShowManualSteps(false);
        } else if (data.homeEmbed.courseAccess === false) {
          setSuccess("Alert settings saved for this course.");
          setError(data.homeEmbed.reason);
          if (data.homeEmbed.manualHtml) setManualHtml(data.homeEmbed.manualHtml);
          setShowManualSteps(true);
        } else {
          setSuccess("Alert settings saved for this course.");
          setError(`Could not update the course home page: ${data.homeEmbed.reason}`);
          setShowManualSteps(true);
        }
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
      <h1>Course alert settings</h1>
      <p className="course-alerts-setup-lead">
        Choose what students see automatically on the course home page.
      </p>

      {canvasApi && !canvasApi.ready ? (
        <div className="course-alerts-manual-steps course-alerts-server-setup">
          <h2>Canvas API not connected</h2>
          <p>
            The course home page cannot be updated until these Vercel env vars are set
            (Production), then the app is redeployed:
          </p>
          <ul>
            {canvasApi.missing.includes("CANVAS_BASE_URL") ? (
              <li>
                <strong>CANVAS_BASE_URL</strong> = <code>https://mytrades.instructure.com</code>
              </li>
            ) : null}
            {canvasApi.missing.includes("CANVAS_API_TOKEN") ? (
              <li>
                <strong>CANVAS_API_TOKEN</strong> = a Canvas access token from{" "}
                <strong>Account → Settings → New Access Token</strong> (use an admin account)
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}

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

        {showManualSteps ? (
          <div className="course-alerts-manual-steps">
            {courseAccessError ? (
              <>
                <h2>Canvas API cannot update this course automatically</h2>
                <p className="course-alerts-error">{courseAccessError}</p>
                <p>
                  Fix: in Vercel, set <strong>CANVAS_API_TOKEN</strong> to a token from a Canvas{" "}
                  <strong>admin</strong> account, redeploy, then save again.
                </p>
              </>
            ) : (
              <>
                <h2>Add Student Alerts to your course</h2>
                <ol>
                  <li>In Canvas, open your course → <strong>Modules</strong>.</li>
                  <li>Click <strong>+</strong> on a module → <strong>External Tool</strong>.</li>
                  <li>Choose <strong>Student Alerts</strong> → <strong>Add Item</strong>.</li>
                  <li>Come back here and click <strong>Save settings</strong> again.</li>
                </ol>
              </>
            )}

            {manualHtml ? (
              <>
                <h2>Or paste this on the course Front Page manually</h2>
                <ol>
                  <li>Canvas → your course → <strong>Pages</strong></li>
                  <li>Open the <strong>Front Page</strong> → <strong>Edit</strong> → <strong>HTML Editor</strong></li>
                  <li>Paste the HTML below → <strong>Save</strong></li>
                  <li>
                    <strong>Settings</strong> → set <strong>Home Page</strong> to <strong>Front Page</strong>
                  </li>
                </ol>
                <textarea className="course-alerts-manual-html" readOnly rows={6} value={manualHtml} />
              </>
            ) : null}
          </div>
        ) : null}

        <button type="submit" disabled={loading}>
          {loading ? "Saving..." : "Save settings"}
        </button>
      </form>
    </div>
  );
}
