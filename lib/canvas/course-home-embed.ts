import {
  getAppOrigin,
  getCanvasServerConfig,
  getConfiguredLtiClientId,
  getLtiConfig,
} from "@/lib/canvas/config";
import { normalizeCanvasBaseUrl } from "@/lib/canvas/client";
import { createCanvasAdminClient } from "@/lib/canvas/admin-client";
import {
  HOME_EMBED_BANNER_HEIGHT_PX,
  HOME_EMBED_VERSION,
} from "@/lib/canvas/home-embed-constants";

const EMBED_MARKER = 'data-student-alerts-embed="true"';

function escapeHtmlAttribute(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

export function buildFrontPageEmbedHtml(canvasCourseId: string) {
  const { loginUrl } = getLtiConfig();
  const clientId = getConfiguredLtiClientId();
  const { baseUrl } = getCanvasServerConfig();
  const canvasBase = normalizeCanvasBaseUrl(baseUrl);
  const retrievePath =
    `/courses/${canvasCourseId}/external_tools/retrieve` +
    `?display=borderless&url=${encodeURIComponent(loginUrl)}` +
    (clientId ? `&client_id=${encodeURIComponent(clientId)}` : "");
  const retrieveUrl = `${canvasBase}${retrievePath}`;
  const height = HOME_EMBED_BANNER_HEIGHT_PX;

  return (
    `<div ${EMBED_MARKER} data-student-alerts-version="${HOME_EMBED_VERSION}" ` +
    `style="background:#fff;margin:0;padding:0;line-height:0;font-size:0;border:0;">` +
    `<iframe src="${escapeHtmlAttribute(retrieveUrl)}" ` +
    `style="width:100%;height:${height}px;min-height:${height}px;max-height:240px;` +
    `border:0;outline:0;box-shadow:none;display:block;overflow:hidden;background:#fff;" ` +
    `title="Student Alerts" loading="eager" scrolling="no"></iframe>` +
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
      "Settings saved. Students will see a welcome or alert message at the top of Home automatically.",
  };
}

export async function refreshHomeEmbedIfStale(canvasCourseId: string) {
  try {
    const client = createCanvasAdminClient();
    const access = await client.getCourseAccess(canvasCourseId);
    if (!access.ok) return { refreshed: false as const };

    const status = await client.getFrontPageEmbedStatus(canvasCourseId);
    if (
      status.hasStudentAlertsEmbed &&
      status.embedVersion === HOME_EMBED_VERSION
    ) {
      return { refreshed: false as const };
    }

    await setupCourseHomeStudentAlerts(canvasCourseId);
    return { refreshed: true as const };
  } catch {
    return { refreshed: false as const };
  }
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
