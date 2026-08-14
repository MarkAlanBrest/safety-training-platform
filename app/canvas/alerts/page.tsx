import type { Metadata } from "next";
import { cookies } from "next/headers";
import { CourseAlertsViewer } from "@/components/canvas/CourseAlertsViewer";
import { CANVAS_SESSION_COOKIE, decodeCanvasStudentSession } from "@/lib/canvas/session";
import "../course-alerts.css";

export const metadata: Metadata = {
  title: "Course Alerts",
  description: "Bold course alerts from your teacher.",
};

type Props = {
  searchParams: Promise<{
    course?: string;
    courseId?: string;
  }>;
};

export default async function CourseAlertsPage({ searchParams }: Props) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const session = decodeCanvasStudentSession(cookieStore.get(CANVAS_SESSION_COOKIE)?.value || "");
  const courseId = (params.courseId || params.course || session?.courseId || "").trim();
  const courseName = session?.courseName || null;

  return (
    <main className="course-alerts-page">
      {courseId ? (
        <CourseAlertsViewer courseId={courseId} initialCourseName={courseName} />
      ) : (
        <div className="course-alerts-shell">
          <h1>Course alerts</h1>
          {session ? (
            <>
              <p>Canvas connected you, but did not pass a course id for this launch.</p>
              <p>
                In your Canvas developer key, add custom field{" "}
                <strong>course_id</strong> = <code>$Canvas.course.id</code> (along with{" "}
                <strong>user_id</strong> = <code>$Canvas.user.id</code>), then reopen this tool from
                your course.
              </p>
            </>
          ) : (
            <p>
              Open <strong>Student Alerts</strong> from your course in Canvas (Modules → External
              Tool, or add it to the course home page). Canvas will identify you and pass the course
              automatically.
            </p>
          )}
        </div>
      )}
    </main>
  );
}
