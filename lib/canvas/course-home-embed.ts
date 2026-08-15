import {
  getAppOrigin,
  getConfiguredLtiClientId,
} from "@/lib/canvas/config";
import { createCanvasAdminClient } from "@/lib/canvas/admin-client";

const EMBED_MARKER = 'data-student-alerts-embed="true"';

function escapeHtmlAttribute(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function buildFrontPageEmbedHtml(canvasCourseId: string) {
  const embedUrl = `${getAppOrigin()}/canvas/home-embed?course=${encodeURIComponent(canvasCourseId)}`;

  return (
    `<div ${EMBED_MARKER} style="background:#fff;margin:0;padding:0;line-height:0;font-size:0;">` +
    `<iframe src="${escapeHtmlAttribute(embedUrl)}" ` +
    `style="width:100%;height:1px;min-height:1px;max-height:220px;border:0;outline:0;box-shadow:none;display:block;overflow:hidden;background:#fff;" ` +
    `title="Student Alerts" loading="eager" scrolling="no" referrerpolicy="no-referrer"></iframe>` +
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

  const { frontPageUrl } = await client.prependEmbedToFrontPage(
    canvasCourseId,
    buildFrontPageEmbedHtml(canvasCourseId),
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
