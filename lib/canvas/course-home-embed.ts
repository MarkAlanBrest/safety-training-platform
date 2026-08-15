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

async function mapPool<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
) {
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      await fn(current);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) || 1 }, () => worker()));
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

export async function setupCourseHomeStudentAlerts(
  canvasCourseId: string,
  options?: { skipToolInstall?: boolean },
) {
  const client = createCanvasAdminClient();
  const access = await client.getCourseAccess(canvasCourseId);
  if (!access.ok) {
    return {
      ok: false as const,
      reason: access.reason,
    };
  }

  if (!options?.skipToolInstall) {
    const clientId = await client.resolveStudentAlertsClientId(getConfiguredLtiClientId());
    const toolOptions = {
      searchName: "Student Alerts",
      clientId,
      launchHost: new URL(getAppOrigin()).hostname,
    };
    await client.ensureAccountExternalTool(toolOptions).catch(() => null);
    if (access.accountId) {
      await client.ensureAccountExternalTool({ ...toolOptions, accountId: access.accountId }).catch(() => null);
    }
    await client.ensureCourseExternalTool(canvasCourseId, toolOptions);
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
    note: "Settings saved for this course only. Students in this class will see Alerts at the top of Home.",
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

export async function installStudentAlertsToolSchoolWide() {
  const client = createCanvasAdminClient();
  const clientId = await client.resolveStudentAlertsClientId(getConfiguredLtiClientId());
  await client.ensureDeveloperKeyEnabled(clientId).catch(() => null);

  const toolOptions = {
    searchName: "Student Alerts",
    clientId,
    launchHost: new URL(getAppOrigin()).hostname,
  };

  const accountIds = await client.listAccountIdsIncludingSubaccounts();
  let accounts = 0;
  const accountErrors: string[] = [];
  for (const accountId of accountIds) {
    try {
      const accountTool = await client.ensureAccountExternalTool({ ...toolOptions, accountId });
      if (accountTool) accounts += 1;
      else accountErrors.push(`Canvas did not install Student Alerts on account ${accountId}.`);
    } catch (error) {
      accountErrors.push(
        error instanceof Error ? error.message : `Could not install on account ${accountId}.`,
      );
    }
  }

  const { courses, accountErrors: courseListErrors, usedFallback } = await client.listPublishedCourses();
  accountErrors.push(...courseListErrors);
  const failed: Array<{ id: number; name?: string; reason: string }> = [];
  let installed = 0;

  for (const course of courses) {
    try {
      const tool = await client.ensureCourseExternalTool(String(course.id), toolOptions);
      if (tool) {
        installed += 1;
      } else {
        failed.push({
          id: course.id,
          name: course.name,
          reason: "Canvas did not add Student Alerts to this course.",
        });
      }
    } catch (error) {
      failed.push({
        id: course.id,
        name: course.name,
        reason: error instanceof Error ? error.message : "Could not add the tool to this course.",
      });
    }
  }

  const fallbackWarning = usedFallback
    ? `Could not list courses at the account level (${
        courseListErrors[0] || "no accounts were readable"
      }), so only courses the Canvas API token's own user is enrolled in were reached. Use a Canvas admin API token with account-level course access to cover every course.`
    : null;

  return {
    ok: true as const,
    accounts,
    courses: courses.length,
    installed,
    failed,
    usedFallback,
    note:
      fallbackWarning ||
      (installed > 0
        ? `The Student Alerts tool is available in ${installed} course${installed === 1 ? "" : "s"}. Settings are not copied — each class still needs its own setup.`
        : accountErrors[0] ||
          (accounts > 0
            ? "The account app was installed, but Canvas did not add it to individual courses yet."
            : "Could not install Student Alerts on the Canvas account. Use a Canvas admin API token.")),
    accountErrors,
  };
}

export async function diagnoseStudentAlertsTool(canvasCourseId: string) {
  const origin = getAppOrigin();
  const client = createCanvasAdminClient();
  const clientId = await client.resolveStudentAlertsClientId(getConfiguredLtiClientId());

  const definitions = await client
    .listLinkSelectionLaunchDefinitions(canvasCourseId)
    .catch(() => [] as Array<{ name?: string }>);
  const inModulePicker = definitions.some((item) => {
    const name = (item.name || "").toLowerCase();
    return name.includes("alert") || name.includes("student");
  });

  const accountTools = await client.listAccountExternalTools("self").catch(() => []);
  const courseTool = await client
    .findCourseExternalTool(canvasCourseId, {
      searchName: "Student Alerts",
      clientId,
      launchHost: origin ? new URL(origin).hostname : undefined,
    })
    .catch(() => null);

  return {
    clientId: clientId || null,
    targetLinkUri: origin ? `${origin}/api/lti/launch` : null,
    jsonUrl: origin ? `${origin}/canvas-lti-key.json` : null,
    inModulePicker,
    modulePickerTools: definitions.map((item) => item.name).filter(Boolean),
    courseHasTool: Boolean(courseTool),
    accountHasTool: accountTools.some((tool) => {
      const name = (tool.name || "").toLowerCase();
      return Boolean(clientId && tool.client_id === clientId) || name.includes("alert");
    }),
  };
}

export async function enableStudentAlertsInAllCourses() {
  const client = createCanvasAdminClient();
  const clientId = await client.resolveStudentAlertsClientId(getConfiguredLtiClientId());
  await client.ensureDeveloperKeyEnabled(clientId).catch(() => null);
  await client
    .ensureAccountExternalTool({
      searchName: "Student Alerts",
      clientId,
      launchHost: new URL(getAppOrigin()).hostname,
    })
    .catch(() => null);

  const listed = await client.listPublishedCourses();
  let courses = listed.courses;
  const courseListErrors = [...listed.accountErrors];
  let usedFallback = listed.usedFallback;

  if (courses.length > 80) {
    const mine = await client.listTokenUserCourses();
    if (mine.length > 0 && mine.length <= 80) {
      courseListErrors.push(
        `School has ${courses.length} live courses. Enabling ${mine.length} courses this Canvas token user can access now.`,
      );
      courses = mine;
      usedFallback = true;
    } else {
      courses = courses.slice(0, 80);
      courseListErrors.push(
        `School has ${listed.courses.length} live courses. Enabling the first 80 in this run.`,
      );
    }
  }

  const failed: Array<{ id: number; name?: string; reason: string }> = [];
  let enabled = 0;

  await mapPool(courses, 6, async (course) => {
    try {
      const result = await setupCourseHomeStudentAlerts(String(course.id), { skipToolInstall: true });
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
  });

  const fallbackWarning = usedFallback
    ? `Could not list every account course (${
        courseListErrors[0] || "no accounts were readable"
      }). Use a Canvas admin API token so every class is included.`
    : null;

  return {
    ok: true as const,
    enabled,
    installed: enabled,
    accounts: 1,
    total: courses.length,
    failed,
    usedFallback,
    accountErrors: courseListErrors,
    note:
      fallbackWarning ||
      (enabled > 0
        ? `Student Alerts is on in ${enabled} class${enabled === 1 ? "" : "es"}. Each class keeps its own settings.`
        : "Could not turn on Student Alerts in other classes."),
  };
}

let lastSchoolWideEnableAt = 0;
const SCHOOL_WIDE_COOLDOWN_MS = 2 * 60 * 1000;

export function scheduleSchoolWideEnable() {
  const now = Date.now();
  if (now - lastSchoolWideEnableAt < SCHOOL_WIDE_COOLDOWN_MS) return;
  lastSchoolWideEnableAt = now;
  void enableStudentAlertsInAllCourses().catch((error) => {
    lastSchoolWideEnableAt = 0;
    console.error("School-wide Student Alerts enable failed:", error);
  });
}

