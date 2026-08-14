"use client";

import { useCallback, useEffect, useState } from "react";
import AdminShell from "@/components/AdminShell";
import { displayStudentName } from "@/lib/course-alerts";

type Signup = {
  id: number;
  studentName: string;
  normalizedName: string;
  createdAt: string;
};

type SentMessage = {
  id: number;
  studentName: string;
  message: string;
  createdAt: string;
};

export default function AdminCourseAlertsPage() {
  const [courseId, setCourseId] = useState("");
  const [courseName, setCourseName] = useState("");
  const [signups, setSignups] = useState<Signup[]>([]);
  const [messages, setMessages] = useState<SentMessage[]>([]);
  const [studentName, setStudentName] = useState("");
  const [alertMessage, setAlertMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadCourse = useCallback(async () => {
    if (!courseId.trim()) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/course-alerts/signups?courseId=${encodeURIComponent(courseId.trim())}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not load signups.");
      }
      setSignups(data.signups || []);
      setMessages(data.messages || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load signups.");
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    if (!courseId.trim()) return;
    void loadCourse();
  }, [courseId, loadCourse]);

  async function handleSend(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/course-alerts/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: courseId.trim(),
          courseName: courseName.trim() || null,
          studentName: displayStudentName(studentName),
          message: alertMessage.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not send alert.");
      }
      setAlertMessage("");
      setSuccess(`Alert sent to ${data.message.studentName}.`);
      await loadCourse();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Could not send alert.");
    } finally {
      setLoading(false);
    }
  }

  async function clearMessage(id: number) {
    await fetch(`/api/course-alerts/clear?id=${id}`, { method: "DELETE" });
    await loadCourse();
  }

  const embedPath = courseId.trim()
    ? `/canvas/alerts?course=${encodeURIComponent(courseId.trim())}`
    : "";

  return (
    <AdminShell title="Course alerts" eyebrow="Teacher">
      <div className="grid gap-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">Course setup</h2>
          <p className="mt-2 text-slate-600">
            Use the Canvas course id from the course URL. Students sign up with their name on the embed page.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              Canvas course id
              <input
                className="rounded-xl border border-slate-300 px-4 py-3"
                value={courseId}
                onChange={(event) => setCourseId(event.target.value)}
                placeholder="12345"
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              Course name (optional)
              <input
                className="rounded-xl border border-slate-300 px-4 py-3"
                value={courseName}
                onChange={(event) => setCourseName(event.target.value)}
                placeholder="Welding 101"
              />
            </label>
          </div>
          {embedPath ? (
            <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
              Embed on the course home page:
              <br />
              <code className="break-all">{embedPath}</code>
            </p>
          ) : null}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">Send alert</h2>
          <form className="mt-4 grid gap-4" onSubmit={handleSend}>
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              Signed-up student
              <select
                className="rounded-xl border border-slate-300 px-4 py-3"
                value={studentName}
                onChange={(event) => setStudentName(event.target.value)}
                required
              >
                <option value="">Select a student</option>
                {signups.map((signup) => (
                  <option key={signup.id} value={signup.studentName}>
                    {signup.studentName}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              Message
              <textarea
                className="min-h-28 rounded-xl border border-slate-300 px-4 py-3"
                value={alertMessage}
                onChange={(event) => setAlertMessage(event.target.value)}
                placeholder="Turn in your missing safety quiz today."
                required
              />
            </label>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            {success ? <p className="text-sm text-green-700">{success}</p> : null}
            <button
              type="submit"
              className="rounded-xl bg-red-600 px-5 py-3 font-bold text-white"
              disabled={loading || !signups.length}
            >
              {loading ? "Sending..." : "Send alert"}
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">Signed up ({signups.length})</h2>
          {signups.length ? (
            <ul className="mt-4 space-y-2">
              {signups.map((signup) => (
                <li key={signup.id} className="rounded-xl bg-slate-50 px-4 py-3 text-slate-800">
                  {signup.studentName}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-slate-600">No students have signed up for this course yet.</p>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">Recent alerts</h2>
          {messages.length ? (
            <ul className="mt-4 space-y-3">
              {messages.map((message) => (
                <li key={message.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-bold text-slate-900">{message.studentName}</p>
                      <p className="mt-1 text-slate-700">{message.message}</p>
                    </div>
                    <button
                      type="button"
                      className="text-sm font-semibold text-red-600"
                      onClick={() => void clearMessage(message.id)}
                    >
                      Clear
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-slate-600">No active alerts yet.</p>
          )}
        </section>
      </div>
    </AdminShell>
  );
}
