import { createCanvasAdminClient } from "@/lib/canvas/admin-client";
import { buildTestHomePageBody } from "@/lib/canvas/course-home-page-html";

const FRONT_PAGE_URL = "student-alerts-home";
const FRONT_PAGE_TITLE = "Student Alerts";

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
      manualHtml: buildTestHomePageBody(options?.bannerMessage),
    };
  }

  const body = buildTestHomePageBody(options?.bannerMessage);

  await client.upsertCourseFrontPage(canvasCourseId, {
    url: FRONT_PAGE_URL,
    title: FRONT_PAGE_TITLE,
    body,
  });
  await client.setCourseHomeToFrontPage(canvasCourseId, FRONT_PAGE_URL);

  const homeStatus = await client.getCourseHomeStatus(canvasCourseId);

  return {
    ok: true as const,
    frontPageUrl: FRONT_PAGE_URL,
    mode: "test_message" as const,
    courseAccess: true,
    verified: homeStatus.hasStudentAlertsEmbed && homeStatus.defaultView === "wiki",
    home: homeStatus,
  };
}
