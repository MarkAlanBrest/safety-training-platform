import type { Metadata } from "next";
import { CourseAlertsSignup } from "@/components/canvas/CourseAlertsSignup";
import "../course-alerts.css";

export const metadata: Metadata = {
  title: "Course Alerts",
  description: "Sign up for bold course alerts from your teacher.",
};

type Props = {
  searchParams: Promise<{
    course?: string;
    courseId?: string;
    name?: string;
  }>;
};

export default async function CourseAlertsPage({ searchParams }: Props) {
  const params = await searchParams;
  const courseId = (params.courseId || params.course || "").trim();

  if (!courseId) {
    return (
      <main className="course-alerts-page">
        <div className="course-alerts-shell">
          <h1>Course alerts</h1>
          <p>Add this page to your course with the course id in the link, for example:</p>
          <code>/canvas/alerts?course=12345</code>
        </div>
      </main>
    );
  }

  return (
    <main className="course-alerts-page">
      <CourseAlertsSignup courseId={courseId} courseName={params.name} />
    </main>
  );
}
