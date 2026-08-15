import { getAppOrigin, getCanvasServerConfig, getConfiguredLtiClientId } from "@/lib/canvas/config";
import { createCanvasAdminClient } from "@/lib/canvas/admin-client";

const EMBED_MARKER = 'data-student-alerts-embed="true"';

function buildFrontPageEmbedHtml(canvasCourseId: string, toolId: number) {
  const iframeSrc = `/courses/${canvasCourseId}/external_tools/${toolId}?display=borderless`;
  return (
    `<div ${EMBED_MARKER}>` +
    `<iframe src="${iframeSrc}" ` +
    `style="width:100%;min-height:48px;border:0;display:block;" ` +
    `title="Student Alerts" loading="lazy"></iframe>` +
    `</div>`
  );
}

export async function setupCourseHomeStudentAlerts(canvasCourseId: string) {
  const client = createCanvasAdminClient();
  const access = await client.getCourseAccess(canvasCourseId);
  if (!access.ok) {
    return {
      ok: false as const,
      reason: access.reason,
    };
  }

  const tool = await client.findCourseExternalTool(canvasCourseId, {
    searchName: "Student Alerts",
    clientId: getConfiguredLtiClientId(),
    launchHost: new URL(getAppOrigin() || getCanvasServerConfig().baseUrl).hostname,
  });

  if (!tool) {
    return {
      ok: false as const,
      reason:
        "Add Student Alerts from Modules → External Tool first, then save settings again.",
    };
  }

  await client.prependEmbedToFrontPage(canvasCourseId, buildFrontPageEmbedHtml(canvasCourseId, tool.id));

  return {
    ok: true as const,
    mode: "front_page_embed" as const,
    externalToolId: tool.id,
    note:
      "Settings saved. A slim alert strip was added to the top of your existing front page. It only shows for students when there is something to communicate.",
  };
}
