import type { Metadata } from "next";
import { Suspense } from "react";
import {
  CourseAlertsSetupForm,
  type CourseAlertsSetupConfig,
} from "@/components/canvas/CourseAlertsSetupForm";
import { getCourseAlertConfig } from "@/lib/course-alerts/store";
import "../../course-alerts.css";

export const metadata: Metadata = {
  title: "Course Alert Setup",
  description: "Configure student alerts for your Canvas course.",
};

type Props = {
  searchParams: Promise<{
    course?: string;
    courseId?: string;
    mode?: string;
  }>;
};

function LoadingCourseSettings() {
  return (
    <div className="course-alerts-setup-loading" role="status" aria-live="polite">
      <span className="course-alerts-setup-spinner" aria-hidden="true" />
      <div>
        <strong>Loading course settings</strong>
        <p>Please wait while Canvas connects to this course.</p>
      </div>
    </div>
  );
}

async function CourseAlertsSetupContent({ searchParams }: Props) {
  const params = await searchParams;
  const courseId = (params.course || params.courseId || "").trim();
  let initialConfig: CourseAlertsSetupConfig | null = null;

  if (courseId) {
    try {
      initialConfig = await getCourseAlertConfig(courseId);
    } catch {
      // Preserve the existing defaults if the settings lookup is temporarily unavailable.
    }
  }

  return (
    <CourseAlertsSetupForm
      courseId={courseId}
      importMode={params.mode === "import"}
      initialConfig={initialConfig}
    />
  );
}

export default function CourseAlertsSetupPage({ searchParams }: Props) {
  return (
    <main className="course-alerts-page course-alerts-page-setup">
      <Suspense fallback={<LoadingCourseSettings />}>
        <CourseAlertsSetupContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
