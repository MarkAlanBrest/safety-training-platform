import type { Metadata } from "next";
import { cookies } from "next/headers";
import { CourseHomeBanner } from "@/components/canvas/CourseHomeBanner";
import { CANVAS_SESSION_COOKIE, decodeCanvasStudentSession } from "@/lib/canvas/session";
import { getCourseAlertConfig } from "@/lib/course-alerts/store";
import { parseLaunchHandoff } from "@/lib/lti/launch-handoff";
import "../course-alerts.css";

export const metadata: Metadata = {
  title: "Course Alerts",
  description: "Slim course alert banner for the Canvas home page.",
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
  const initialConfig = courseId ? await getCourseAlertConfig(courseId) : null;

  if (!courseId) {
    return <div className="course-home-banner-empty" aria-hidden="true" />;
  }

  return (
    <main className="course-alerts-page course-alerts-page-embed">
      <CourseHomeBanner
        courseId={courseId}
        initialBannerMessage={initialConfig?.bannerMessage || null}
        handoffToken={params.handoff || null}
      />
    </main>
  );
}
