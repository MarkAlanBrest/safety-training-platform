import type { Metadata } from "next";
import { Suspense } from "react";
import { CourseAlertsSetupForm } from "@/components/canvas/CourseAlertsSetupForm";
import "../../course-alerts.css";

export const metadata: Metadata = {
  title: "Course Alert Setup",
  description: "Configure student alerts for your Canvas course.",
};

export default function CourseAlertsSetupPage() {
  return (
    <main className="course-alerts-page course-alerts-page-setup">
      <Suspense fallback={<div className="course-alerts-loading">Loading setup...</div>}>
        <CourseAlertsSetupForm />
      </Suspense>
    </main>
  );
}
