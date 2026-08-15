import { getAppOrigin, getConfiguredLtiClientId, getLtiConfig } from "@/lib/canvas/config";
import { createCanvasAdminClient } from "@/lib/canvas/admin-client";

const EMBED_MARKER = 'data-student-alerts-embed="true"';

function buildFrontPageEmbedHtml(canvasCourseId: string) {
  const { launchUrl } = getLtiConfig();
  const retrieveUrl =
    `/courses/${canvasCourseId}/external_tools/retrieve` +
    `?display=borderless&url=${encodeURIComponent(launchUrl)}`;

  return (
    `<div ${EMBED_MARKER}>` +
    `<iframe src="${retrieveUrl.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}" ` +
    `style="width:100%;height:72px;border:0;display:block;overflow:hidden;" ` +
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
    launchHost: new URL(getAppOrigin()).hostname,
  });

  if (!tool) {
    return {
      ok: false as const,
      reason:
        "Add Student Alerts from Modules → External Tool first, then save settings again.",
    };
  }

  await client.prependEmbedToFrontPage(canvasCourseId, buildFrontPageEmbedHtml(canvasCourseId));

  return {
    ok: true as const,
    mode: "front_page_embed" as const,
    note:
      "Settings saved. The home page embed was refreshed. It only shows a bold strip when a student has something they need to see.",
  };
}
