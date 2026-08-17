import type { Metadata } from "next";
import { cookies } from "next/headers";
import { CANVAS_SESSION_COOKIE, decodeCanvasStudentSession } from "@/lib/canvas/session";
import { getCourseAlertConfig } from "@/lib/course-alerts/store";
import { parseLaunchHandoff } from "@/lib/lti/launch-handoff";
import "../course-alerts.css";

export const metadata: Metadata = {
  title: "Email Alerts",
  description: "Configure email alerts for your Canvas course.",
};

type Props = {
  searchParams: Promise<{
    course?: string;
    courseId?: string;
    handoff?: string;
  }>;
};

export default async function EmailAlertsPage({ searchParams }: Props) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const cookieSession = decodeCanvasStudentSession(cookieStore.get(CANVAS_SESSION_COOKIE)?.value || "");
  const handoff = params.handoff ? parseLaunchHandoff(params.handoff) : null;
  const courseId = (
    params.courseId ||
    params.course ||
    handoff?.courseId ||
    cookieSession?.courseId ||
    ""
  ).trim();
  const role = handoff?.role || cookieSession?.role || null;
  const courseName =
    handoff?.courseName || cookieSession?.courseName || (courseId ? (await getCourseAlertConfig(courseId))?.courseName : null) || null;
  const instructorName = handoff?.name || cookieSession?.name || null;

  if (role === "student") {
    return (
      <main className="course-alerts-page course-alerts-page-setup">
        <div className="course-alerts-shell">
          <h1>Email Alerts</h1>
          <p>Only a course instructor can open Email Alerts.</p>
        </div>
      </main>
    );
  }

  if (!courseId) {
    return (
      <main className="course-alerts-page course-alerts-page-setup">
        <div className="course-alerts-shell">
          <h1>Email Alerts</h1>
          <p>Open this page from your Canvas course navigation menu.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="course-alerts-page course-alerts-page-setup">
      <div className="course-alerts-shell course-alerts-setup">
        <h1>Email Alerts</h1>
        <p className="course-alerts-setup-lead">
          This is a test page for the teacher-only <strong>Email Alerts</strong> course navigation
          button. Email alert settings will live here in a future update.
        </p>

        <fieldset className="course-alerts-setup-block">
          <legend>Launch details</legend>
          <p>
            <strong>Course:</strong> {courseName || `Course ${courseId}`}
          </p>
          <p>
            <strong>Course ID:</strong> {courseId}
          </p>
          {instructorName ? (
            <p>
              <strong>Instructor:</strong> {instructorName}
            </p>
          ) : null}
        </fieldset>

        <p className="course-alerts-quiet">
          Teachers see this link in the course navigation menu. Students do not.
        </p>
      </div>
    </main>
  );
}
