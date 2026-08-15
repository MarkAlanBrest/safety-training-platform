import type { Metadata } from "next";
import { after } from "next/server";
import { cookies } from "next/headers";
import { CourseHomeBanner } from "@/components/canvas/CourseHomeBanner";
import { CourseHomeBannerStatic } from "@/components/canvas/CourseHomeBannerStatic";
import { scheduleUnauthorizedEmbedCleanup } from "@/lib/canvas/course-home-embed";
import { CANVAS_SESSION_COOKIE, decodeCanvasStudentSession } from "@/lib/canvas/session";
import { parseLaunchHandoff } from "@/lib/lti/launch-handoff";
import { isCourseHomeAlertsEnabled } from "@/lib/course-alerts/store";
import "../course-alerts.css";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

  if (!courseId) {
    return <CourseHomeBannerStatic />;
  }

  after(() => {
    scheduleUnauthorizedEmbedCleanup();
  });

  if (!(await isCourseHomeAlertsEnabled(courseId))) {
    return <CourseHomeBannerStatic />;
  }

  return (
    <CourseHomeBanner
      courseId={courseId}
      handoffToken={params.handoff || null}
    />
  );
}
