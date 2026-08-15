import {
  getAppOrigin,
  getCanvasServerConfig,
  getConfiguredLtiClientId,
  getLtiConfig,
} from "@/lib/canvas/config";
import { normalizeCanvasBaseUrl } from "@/lib/canvas/client";
import { createCanvasAdminClient } from "@/lib/canvas/admin-client";

const EMBED_MARKER = 'data-student-alerts-embed="true"';

function escapeHtmlAttribute(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function buildFrontPageEmbedHtml(canvasCourseId: string, canvasBaseUrl: string) {
  const { loginUrl } = getLtiConfig();
  const clientId = getConfiguredLtiClientId();
  const retrievePath =
    `/courses/${canvasCourseId}/external_tools/retrieve` +
    `?display=borderless&url=${encodeURIComponent(loginUrl)}` +
    (clientId ? `&client_id=${encodeURIComponent(clientId)}` : "");
  const retrieveUrl = `${normalizeCanvasBaseUrl(canvasBaseUrl)}${retrievePath}`;

  return (
    `<div ${EMBED_MARKER} style="background:#fff;margin:0;padding:0;">` +
    `<iframe src="${escapeHtmlAttribute(retrieveUrl)}" ` +
    `style="width:100%;height:1px;min-height:1px;max-height:220px;border:0;display:block;overflow:hidden;background:#fff;" ` +
    `title="Student Alerts" loading="lazy" allow="clipboard-write"></iframe>` +
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

  const clientId = getConfiguredLtiClientId();
  const tool = await client.ensureCourseExternalTool(canvasCourseId, {
    searchName: "Student Alerts",
    clientId,
    launchHost: new URL(getAppOrigin()).hostname,
  });

  if (!tool && !clientId) {
    return {
      ok: false as const,
      reason:
        "CANVAS_LTI_CLIENT_ID is not set in Vercel. Add it from your Canvas developer key, redeploy, then save again.",
    };
  }

  const { baseUrl } = getCanvasServerConfig();
  const { frontPageUrl } = await client.prependEmbedToFrontPage(
    canvasCourseId,
    buildFrontPageEmbedHtml(canvasCourseId, baseUrl),
  );

  if (frontPageUrl) {
    await client.setCourseHomeToFrontPage(canvasCourseId, frontPageUrl);
  }

  return {
    ok: true as const,
    mode: "front_page_embed" as const,
    note:
      "Settings saved. Students will see a bold reminder at the top of Home automatically when they have missing work, low grades, or a message from you. Nothing shows when there is nothing to communicate.",
  };
}

export async function removeCourseHomeStudentAlerts(canvasCourseId: string) {
  const client = createCanvasAdminClient();
  const access = await client.getCourseAccess(canvasCourseId);
  if (!access.ok) {
    return { ok: false as const, reason: access.reason };
  }

  await client.removeEmbedFromFrontPage(canvasCourseId);
  return { ok: true as const };
}
