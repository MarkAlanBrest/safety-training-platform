import type { Metadata } from "next";
import { CourseAlertsViewer } from "@/components/canvas/CourseAlertsViewer";
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
  const courseId = (params.courseId || params.course || "").trim();

  return (
    <main className="course-alerts-page">
      {courseId ? (
        <CourseAlertsViewer courseId={courseId} />
      ) : (
        <div className="course-alerts-shell">
          <h1>Course alerts</h1>
          <p>Add this tool to your course home page from Canvas Apps. Canvas will pass the course automatically.</p>
        </div>
      )}
    </main>
  );
}
