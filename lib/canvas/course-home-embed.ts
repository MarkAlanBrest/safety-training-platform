import { getAppOrigin } from "@/lib/canvas/config";
import { createCanvasAdminClient } from "@/lib/canvas/admin-client";

const EMBED_MARKER = 'data-student-alerts-embed="true"';

function buildFrontPageEmbedHtml(canvasCourseId: string) {
  const embedUrl = `${getAppOrigin()}/canvas/home-embed?course=${encodeURIComponent(canvasCourseId)}`;
  const safeUrl = embedUrl.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

  return (
    `<div ${EMBED_MARKER}>` +
    `<iframe src="${safeUrl}" ` +
    `style="width:100%;height:1px;min-height:1px;max-height:220px;border:0;display:block;overflow:hidden;" ` +
    `title="Student Alerts" loading="lazy" referrerpolicy="no-referrer"></iframe>` +
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

  await client.prependEmbedToFrontPage(canvasCourseId, buildFrontPageEmbedHtml(canvasCourseId));

  return {
    ok: true as const,
    mode: "front_page_embed" as const,
    note:
      "Settings saved. Old home-page embeds were removed and replaced with a slim alert bar from our app (not Canvas).",
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
