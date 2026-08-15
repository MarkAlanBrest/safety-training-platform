import { getAppOrigin, getCanvasServerConfig, getConfiguredLtiClientId } from "@/lib/canvas/config";
import { createCanvasAdminClient } from "@/lib/canvas/admin-client";

const FRONT_PAGE_URL = "student-alerts-home";
const FRONT_PAGE_TITLE = "Student Alerts";

export async function setupCourseHomeStudentAlerts(canvasCourseId: string) {
  const client = createCanvasAdminClient();
  const tool = await client.findCourseExternalTool(canvasCourseId, {
    searchName: "Student Alerts",
    clientId: getConfiguredLtiClientId(),
    launchHost: new URL(getAppOrigin() || getCanvasServerConfig().baseUrl).hostname,
  });

  if (!tool) {
    return {
      ok: false as const,
      reason:
        "Student Alerts is not installed in this course yet. Add it once from Modules → External Tool, then save settings again.",
    };
  }

  const iframeSrc = `/courses/${canvasCourseId}/external_tools/${tool.id}?display=borderless`;
  const body =
    `<p><iframe src="${iframeSrc}" ` +
    `style="width:100%;min-height:720px;border:0;" ` +
    `title="${FRONT_PAGE_TITLE}" allow="fullscreen" loading="eager"></iframe></p>`;

  await client.upsertCourseFrontPage(canvasCourseId, {
    url: FRONT_PAGE_URL,
    title: FRONT_PAGE_TITLE,
    body,
  });
  await client.setCourseHomeToFrontPage(canvasCourseId, FRONT_PAGE_URL);

  return {
    ok: true as const,
    frontPageUrl: FRONT_PAGE_URL,
    externalToolId: tool.id,
  };
}
