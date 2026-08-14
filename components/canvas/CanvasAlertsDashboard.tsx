"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertOctagon,
  AlertTriangle,
  Bell,
  BellRing,
  BookOpen,
  ExternalLink,
  LogOut,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import type { CanvasAlertSummary } from "@/lib/canvas/types";
import { CanvasLaunchHint } from "@/components/canvas/CanvasLaunchHint";

const REFRESH_MS = 5 * 60 * 1000;

function severityIcon(severity: "critical" | "warning" | "info") {
  if (severity === "critical") return <AlertOctagon size={22} />;
  if (severity === "warning") return <AlertTriangle size={22} />;
  return <Bell size={22} />;
}

function scoreTone(score: number | null) {
  if (score === null) return "neutral";
  if (score < 60) return "critical";
  if (score < 70) return "warning";
  if (score < 80) return "caution";
  return "good";
}

export function CanvasAlertsDashboard() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [summary, setSummary] = useState<CanvasAlertSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const lastNotifiedRef = useRef<string>("");

  const loadStatus = useCallback(async () => {
    const response = await fetch("/api/canvas/status");
    const data = await response.json();
    setConnected(Boolean(data.connected));
    return Boolean(data.connected);
  }, []);

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/canvas/alerts");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to load alerts.");
      }
      setSummary(data as CanvasAlertSummary);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load alerts.");
    } finally {
      setLoading(false);
    }
  }, []);

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
    }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [connected, loadAlerts]);

  useEffect(() => {
    if (!summary || !notificationsEnabled || summary.counts.critical === 0) return;
    const signature = summary.alerts
      .filter((alert) => alert.severity === "critical")
      .map((alert) => alert.id)
      .join(",");
    if (!signature || signature === lastNotifiedRef.current) return;
    lastNotifiedRef.current = signature;

    const body =
      summary.counts.missing > 0
        ? `${summary.counts.missing} missing assignment(s) need attention.`
        : `${summary.counts.critical} critical alert(s) on your Canvas dashboard.`;

    new Notification("Canvas Alert", {
      body,
      tag: "canvas-critical-alerts",
    });
  }, [notificationsEnabled, summary]);

  const criticalAlerts = useMemo(
    () => summary?.alerts.filter((alert) => alert.severity === "critical") || [],
    [summary],
  );

  async function enableNotifications() {
    if (!("Notification" in window)) return;
    const permission = await Notification.requestPermission();
    setNotificationsEnabled(permission === "granted");
  }

  async function disconnect() {
    await fetch("/api/canvas/disconnect", { method: "POST" });
    setConnected(false);
    setSummary(null);
  }

  if (connected === null) {
    return (
      <div className="canvas-page">
        <div className="canvas-loading">Checking Canvas connection...</div>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="canvas-page">
        <CanvasLaunchHint />
      </div>
    );
  }

  return (
    <div className={`canvas-page ${criticalAlerts.length > 0 ? "canvas-page-critical" : ""}`}>
      {criticalAlerts.length > 0 ? (
        <div className="canvas-critical-banner" role="alert" aria-live="assertive">
          <ShieldAlert size={28} />
          <div>
            <strong>{criticalAlerts.length} critical alert{criticalAlerts.length === 1 ? "" : "s"}</strong>
            <p>
              You have {summary?.counts.missing || 0} missing assignment
              {(summary?.counts.missing || 0) === 1 ? "" : "s"} and{" "}
              {summary?.counts.lowGrades || 0} low grade
              {(summary?.counts.lowGrades || 0) === 1 ? "" : "s"} that need attention now.
            </p>
          </div>
        </div>
      ) : null}

      <header className="canvas-header">
        <div>
          <p className="canvas-eyebrow">Canvas LMS Alerts</p>
          <h1>Hi {summary?.user.short_name || summary?.user.name || "student"}, here&apos;s what needs attention</h1>
          <p className="canvas-subtitle">
            Last updated {summary ? new Date(summary.fetchedAt).toLocaleString() : "just now"}
          </p>
        </div>
        <div className="canvas-header-actions">
          <button type="button" className="canvas-secondary-btn" onClick={() => void loadAlerts()} disabled={loading}>
            <RefreshCw size={16} className={loading ? "canvas-spin" : ""} />
            Refresh
          </button>
          {!notificationsEnabled ? (
            <button type="button" className="canvas-secondary-btn" onClick={() => void enableNotifications()}>
              <BellRing size={16} />
              Enable desktop alerts
            </button>
          ) : (
            <span className="canvas-notifications-on">
              <BellRing size={16} /> Desktop alerts on
            </span>
          )}
          <button type="button" className="canvas-secondary-btn" onClick={() => void disconnect()}>
            <LogOut size={16} />
            Disconnect
          </button>
        </div>
      </header>

      {error ? <p className="canvas-error-banner">{error}</p> : null}

      <section className="canvas-stats">
        <article className={`canvas-stat-card critical ${summary?.counts.critical ? "canvas-stat-pulse" : ""}`}>
          <span>Critical</span>
          <strong>{summary?.counts.critical ?? 0}</strong>
        </article>
        <article className="canvas-stat-card warning">
          <span>Warnings</span>
          <strong>{summary?.counts.warning ?? 0}</strong>
        </article>
        <article className="canvas-stat-card info">
          <span>Due soon</span>
          <strong>{summary?.counts.dueSoon ?? 0}</strong>
        </article>
        <article className="canvas-stat-card missing">
          <span>Missing</span>
          <strong>{summary?.counts.missing ?? 0}</strong>
        </article>
      </section>

      <section className="canvas-grid">
        <div className="canvas-panel">
          <div className="canvas-panel-header">
            <h2>
              <AlertTriangle size={20} /> Active alerts
            </h2>
            <span>{summary?.alerts.length || 0} total</span>
          </div>

          {summary?.alerts.length ? (
            <ul className="canvas-alert-list">
              {summary.alerts.map((alert) => (
                <li key={alert.id} className={`canvas-alert-item ${alert.severity} ${alert.kind}`}>
                  <div className="canvas-alert-icon">{severityIcon(alert.severity)}</div>
                  <div className="canvas-alert-body">
                    <div className="canvas-alert-top">
                      <h3>{alert.title}</h3>
                      <span className="canvas-alert-badge">{alert.kind.replace("_", " ")}</span>
                    </div>
                    <p>{alert.message}</p>
                    <p className="canvas-alert-course">{alert.courseName}</p>
                  </div>
                  <a
                    href={alert.link}
                    target="_blank"
                    rel="noreferrer"
                    className="canvas-alert-link"
                    aria-label={`Open ${alert.title} in Canvas`}
                  >
                    <ExternalLink size={18} />
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <div className="canvas-empty-state">
              <Bell size={28} />
              <p>No alerts right now. You&apos;re caught up.</p>
            </div>
          )}
        </div>

        <div className="canvas-panel">
          <div className="canvas-panel-header">
            <h2>
              <BookOpen size={20} /> Course grades
            </h2>
          </div>

          <ul className="canvas-grade-list">
            {(summary?.enrollments || []).map((enrollment) => {
              const tone = scoreTone(enrollment.currentScore);
              return (
                <li key={enrollment.courseId} className={`canvas-grade-item ${tone}`}>
                  <div>
                    <h3>{enrollment.courseName}</h3>
                    {enrollment.courseCode ? <p>{enrollment.courseCode}</p> : null}
                  </div>
                  <div className="canvas-grade-score">
                    <strong>{enrollment.currentScore !== null ? `${enrollment.currentScore.toFixed(1)}%` : "—"}</strong>
                    <span>{enrollment.currentGrade || "No letter grade"}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    </div>
  );
}
