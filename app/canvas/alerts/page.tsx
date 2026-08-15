import type { Metadata } from "next";
import { cookies } from "next/headers";
import { CourseAlertsViewer } from "@/components/canvas/CourseAlertsViewer";
import { CANVAS_SESSION_COOKIE, decodeCanvasStudentSession } from "@/lib/canvas/session";
import { getCourseAlertConfig } from "@/lib/course-alerts/store";
import { parseLaunchHandoff } from "@/lib/lti/launch-handoff";
import "../course-alerts.css";

export const metadata: Metadata = {
  title: "Course Alerts",
  description: "Bold course alerts from your teacher.",
};

type Props = {
  searchParams: Promise<{
    course?: string;
    courseId?: string;
    handoff?: string;
  }>;
};

export default async function CourseAlertsPage({ searchParams }: Props) {
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
  const courseName = handoff?.courseName || cookieSession?.courseName || null;
  const studentName = handoff?.name || cookieSession?.name || null;
  const hasIdentity = Boolean(cookieSession || handoff);
  const initialConfig = courseId ? await getCourseAlertConfig(courseId) : null;

  return (
    <main className="course-alerts-page">
      {courseId ? (
        <CourseAlertsViewer
          courseId={courseId}
          initialCourseName={courseName || initialConfig?.courseName || null}
          initialStudentName={studentName}
          initialBannerMessage={initialConfig?.bannerMessage || null}
          handoffToken={params.handoff || null}
        />
      ) : (
        <div className="course-alerts-shell">
          <h1>Course alerts</h1>
          {hasIdentity ? (
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
            <>
              <p>
                Open <strong>Student Alerts</strong> from your course in Canvas (Modules → External
                Tool). Do not bookmark this page directly.
              </p>
              <p className="course-alerts-quiet">
                The tool must launch through Canvas LTI at{" "}
                <code>/api/lti/launch</code>, not <code>/canvas/alerts</code>.
              </p>
            </>
          )}
        </div>
      )}
    </main>
  );
}
