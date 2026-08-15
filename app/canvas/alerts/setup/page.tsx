import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CourseAlertsSetupForm } from "@/components/canvas/CourseAlertsSetupForm";
import { CANVAS_SESSION_COOKIE, decodeCanvasStudentSession } from "@/lib/canvas/session";
import { parseLaunchHandoff } from "@/lib/lti/launch-handoff";
import "../../course-alerts.css";

export const metadata: Metadata = {
  title: "Course Alert Setup",
  description: "Configure student alerts for your Canvas course.",
};

type Props = {
  searchParams: Promise<{
    course?: string;
    courseId?: string;
    handoff?: string;
  }>;
};

export default async function CourseAlertsSetupPage({ searchParams }: Props) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const session = decodeCanvasStudentSession(cookieStore.get(CANVAS_SESSION_COOKIE)?.value || "");
  const handoff = params.handoff ? parseLaunchHandoff(params.handoff) : null;
  const courseId = (
    params.courseId ||
    params.course ||
    handoff?.courseId ||
    session?.courseId ||
    ""
  ).trim();
  const isInstructor = handoff?.isInstructor ?? session?.isInstructor;

  if (isInstructor === false && courseId) {
    const query = new URLSearchParams({ course: courseId });
    if (params.handoff) query.set("handoff", params.handoff);
    redirect(`/canvas/alerts?${query.toString()}`);
  }

  return (
    <main className="course-alerts-page">
      <Suspense fallback={<div className="course-alerts-loading">Loading setup...</div>}>
        <CourseAlertsSetupForm />
      </Suspense>
    </main>
  );
}
