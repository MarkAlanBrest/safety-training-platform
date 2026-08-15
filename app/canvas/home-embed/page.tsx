import type { Metadata } from "next";
import { cookies } from "next/headers";
import { CourseHomeBanner } from "@/components/canvas/CourseHomeBanner";
import { getStudentDisplayName } from "@/lib/canvas/home-embed-messages";
import { CANVAS_SESSION_COOKIE, decodeCanvasStudentSession } from "@/lib/canvas/session";
import { parseLaunchHandoff } from "@/lib/lti/launch-handoff";
import "../course-alerts.css";

export const metadata: Metadata = {
  title: "Alerts",
  description: "Course home alerts",
};

type Props = {
  searchParams: Promise<{
    course?: string;
    courseId?: string;
    handoff?: string;
  }>;
};

export default async function CourseHomeEmbedPage({ searchParams }: Props) {
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
  const studentName = getStudentDisplayName(handoff?.name || cookieSession?.name);

  if (!courseId) {
    return <div className="course-home-banner-empty" aria-hidden="true" />;
  }

  return (
    <CourseHomeBanner
      courseId={courseId}
      studentName={studentName}
      handoffToken={params.handoff || null}
    />
  );
}
