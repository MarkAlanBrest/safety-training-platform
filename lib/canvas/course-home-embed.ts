import { createCanvasAdminClient } from "@/lib/canvas/admin-client";
import {
  buildCourseAnnouncementBody,
  COURSE_ALERT_ANNOUNCEMENT_TITLE,
} from "@/lib/canvas/course-home-page-html";

export async function setupCourseHomeStudentAlerts(
  canvasCourseId: string,
  options?: { bannerMessage?: string | null },
) {
  const client = createCanvasAdminClient();
  const access = await client.getCourseAccess(canvasCourseId);
  if (!access.ok) {
    return {
      ok: false as const,
      reason: access.reason,
      courseAccess: false,
    };
  }

  const message = buildCourseAnnouncementBody(options?.bannerMessage);
  const announcement = await client.upsertCourseAnnouncement(canvasCourseId, {
    title: COURSE_ALERT_ANNOUNCEMENT_TITLE,
    message,
  });

  return {
    ok: true as const,
    mode: "announcement" as const,
    courseAccess: true,
    announcementId: announcement.id,
    defaultView: access.defaultView,
    note:
      access.defaultView === "wiki"
        ? "Your course Home uses a Front Page. The announcement was posted, but students may need to open Announcements to see it. Open Student Alerts from Modules for the popup reminder."
        : "A bold announcement was posted to the course Home feed. Your existing home page was not changed.",
  };
}
