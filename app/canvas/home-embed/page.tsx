import type { Metadata } from "next";
import { cookies } from "next/headers";
import { CourseHomeBannerStatic } from "@/components/canvas/CourseHomeBannerStatic";
import { CourseHomeEmbedResizer } from "@/components/canvas/CourseHomeEmbedResizer";
import { refreshHomeEmbedIfStale } from "@/lib/canvas/course-home-embed";
import { CANVAS_SESSION_COOKIE, decodeCanvasStudentSession } from "@/lib/canvas/session";
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

  if (courseId) {
    void refreshHomeEmbedIfStale(courseId);
  }

  if (!courseId) {
    return (
      <main className="course-alerts-page course-alerts-page-embed">
        <div className="course-home-embed-shell">
          <div className="course-home-banner-top-pixel" aria-hidden="true" />
        </div>
        <CourseHomeEmbedResizer />
      </main>
    );
  }

  return (
    <main className="course-alerts-page course-alerts-page-embed">
      <CourseHomeBannerStatic />
      <CourseHomeEmbedResizer />
    </main>
  );
}
