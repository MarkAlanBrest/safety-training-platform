import { getAppOrigin, getConfiguredLtiClientId } from "@/lib/canvas/config";
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
  const embedUrl = `${getAppOrigin()}/canvas/home-embed?course=${encodeURIComponent(canvasCourseId)}`;
  const height = HOME_EMBED_BANNER_HEIGHT_PX;

  return (
    `<div ${EMBED_MARKER} data-student-alerts-version="${HOME_EMBED_VERSION}" ` +
    `style="background:#fff;margin:0;padding:0;line-height:0;font-size:0;border:0;">` +
    `<iframe src="${escapeHtmlAttribute(embedUrl)}" ` +
    `width="100%" height="${height}" ` +
    `style="width:100%;height:${height}px;min-height:${height}px;border:0;outline:0;` +
    `box-shadow:none;display:block;overflow:hidden;background:#fff;" ` +
    `title="Alerts" loading="eager" scrolling="no" referrerpolicy="no-referrer"></iframe>` +
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
  if (clientId) {
    await client.ensureAccountExternalTool({
      searchName: "Student Alerts",
      clientId,
      launchHost: new URL(getAppOrigin()).hostname,
    }).catch(() => null);
    await client.ensureCourseExternalTool(canvasCourseId, {
      searchName: "Student Alerts",
      clientId,
      launchHost: new URL(getAppOrigin()).hostname,
    });
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
    note: "Settings saved. Students will see Alerts at the top of Home automatically.",
  };
}

export async function refreshHomeEmbedIfStale(canvasCourseId: string) {
  try {
    const client = createCanvasAdminClient();
    const access = await client.getCourseAccess(canvasCourseId);
    if (!access.ok) return { refreshed: false as const };

    const status = await client.getFrontPageEmbedStatus(canvasCourseId);
    const hasCanvasNestedFrame = Boolean(
      status.frontPageBody?.includes("/external_tools/") ||
        status.frontPageBody?.includes("instructure.com/courses/"),
    );
    if (
      status.hasStudentAlertsEmbed &&
      status.embedVersion === HOME_EMBED_VERSION &&
      !hasCanvasNestedFrame
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

export async function enableStudentAlertsSchoolWide() {
  const client = createCanvasAdminClient();
  const clientId = getConfiguredLtiClientId();
  if (!clientId) {
    return {
      ok: false as const,
      reason: "CANVAS_LTI_CLIENT_ID is not set in Vercel.",
      enabled: 0,
      failed: [] as Array<{ id: number; name?: string; reason: string }>,
    };
  }

  await client.ensureAccountExternalTool({
    searchName: "Student Alerts",
    clientId,
    launchHost: new URL(getAppOrigin()).hostname,
  });

  const courses = await client.listPublishedCourses();
  const failed: Array<{ id: number; name?: string; reason: string }> = [];
  let enabled = 0;

  for (const course of courses) {
    try {
      const result = await setupCourseHomeStudentAlerts(String(course.id));
      if (result.ok) {
        enabled += 1;
      } else {
        failed.push({ id: course.id, name: course.name, reason: result.reason });
      }
    } catch (error) {
      failed.push({
        id: course.id,
        name: course.name,
        reason: error instanceof Error ? error.message : "Could not enable this course.",
      });
    }
  }

  return {
    ok: true as const,
    enabled,
    total: courses.length,
    failed,
    note:
      enabled > 0
        ? `Student Alerts is on in ${enabled} course${enabled === 1 ? "" : "s"}. Teachers will also see it in course navigation after the developer key includes Course Navigation.`
        : "The account app was installed, but no course home pages could be updated.",
  };
}
