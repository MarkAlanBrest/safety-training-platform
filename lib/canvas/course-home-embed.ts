import { getAppOrigin, getCanvasServerConfig, getConfiguredLtiClientId } from "@/lib/canvas/config";
import { createCanvasAdminClient } from "@/lib/canvas/admin-client";

const FRONT_PAGE_URL = "student-alerts-home";
const FRONT_PAGE_TITLE = "Student Alerts";

function buildCourseHomePageBody(canvasCourseId: string, toolId: number) {
  const launchPath = `/courses/${canvasCourseId}/external_tools/${toolId}?display=borderless`;
  const launchUrl = launchPath.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

  // Canvas often strips iframes from wiki pages. Use a redirect first, then iframe, then a visible link.
  return [
    `<p><strong>${FRONT_PAGE_TITLE}</strong></p>`,
    `<p>Loading alerts...</p>`,
    `<meta http-equiv="refresh" content="0;url=${launchUrl}" />`,
    `<p><a id="student-alerts-launch" href="${launchUrl}" target="_top">Open Student Alerts</a></p>`,
    `<p><iframe src="${launchUrl}" style="width:100%;min-height:720px;border:0;" title="${FRONT_PAGE_TITLE}" allow="fullscreen" loading="eager"></iframe></p>`,
  ].join("\n");
}

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

  const body = buildCourseHomePageBody(canvasCourseId, tool.id);

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
