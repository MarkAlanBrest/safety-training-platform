"use client";

import { CourseAlertsViewer } from "@/components/canvas/CourseAlertsViewer";
import { CourseHomeBanner } from "@/components/canvas/CourseHomeBanner";
import { useEffect, useState } from "react";

type Props = {
  courseId: string;
  initialCourseName?: string | null;
  initialStudentName?: string | null;
  initialBannerMessage?: string | null;
  handoffToken?: string | null;
};

export function CourseAlertsShell({
  courseId,
  initialCourseName = null,
  initialStudentName = null,
  initialBannerMessage = null,
  handoffToken = null,
}: Props) {
  const [embedded, setEmbedded] = useState(false);

  useEffect(() => {
    setEmbedded(window.self !== window.top);
  }, []);

  if (embedded) {
    return (
      <CourseHomeBanner
        courseId={courseId}
        initialBannerMessage={initialBannerMessage}
        handoffToken={handoffToken}
      />
    );
  }

  return (
    <CourseAlertsViewer
      courseId={courseId}
      initialCourseName={initialCourseName}
      initialStudentName={initialStudentName}
      initialBannerMessage={initialBannerMessage}
      handoffToken={handoffToken}
    />
  );
}
