import { after } from "next/server";
import { getAppOrigin, getConfiguredLtiClientId, getLtiConfig } from "@/lib/canvas/config";
import { createCanvasAdminClient } from "@/lib/canvas/admin-client";
import {
  HOME_EMBED_BANNER_HEIGHT_PX,
  HOME_EMBED_VERSION,
} from "@/lib/canvas/home-embed-constants";
import { prisma } from "@/lib/prisma";
import {
  backfillExistingConfigsAsHomeEnabled,
  isCourseHomeAlertsEnabled,
  listHomeAlertsEnabledCourseIds,
  setCourseHomeAlertsEnabled,
} from "@/lib/course-alerts/store";

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
  const { launchUrl } = getLtiConfig();
  const homeLaunchUrl = new URL(launchUrl);
  homeLaunchUrl.searchParams.set("placement", "home_embed");
  const embedUrl =
    `/courses/${encodeURIComponent(canvasCourseId)}/external_tools/retrieve` +
    `?display=borderless&url=${encodeURIComponent(homeLaunchUrl.toString())}`;
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

  const { frontPageUrl, alreadyEmbedded } = await client.prependEmbedToFrontPage(
    canvasCourseId,
    buildFrontPageEmbedHtml(canvasCourseId),
  );

  if (frontPageUrl && (!alreadyEmbedded || access.defaultView !== "wiki")) {
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
    if (!(await isCourseHomeAlertsEnabled(canvasCourseId))) {
      return { refreshed: false as const };
    }

    const client = createCanvasAdminClient();
    const access = await client.getCourseAccess(canvasCourseId);
    if (!access.ok) return { refreshed: false as const };

    const status = await client.getFrontPageEmbedStatus(canvasCourseId);
    const hasAuthenticatedEmbed = Boolean(
      status.frontPageBody?.includes("/external_tools/retrieve"),
    );
    if (
      status.hasStudentAlertsEmbed &&
      status.embedVersion === HOME_EMBED_VERSION &&
      hasAuthenticatedEmbed
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
  await setCourseHomeAlertsEnabled(canvasCourseId, false);
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

  let accounts = 0;
  const accountErrors: string[] = [];
  try {
    const accountTool = await client.ensureAccountExternalTool(toolOptions);
    if (accountTool) accounts = 1;
    else accountErrors.push("Canvas did not install Student Alerts on the account.");
  } catch (error) {
    accountErrors.push(error instanceof Error ? error.message : "Could not install on the Canvas account.");
  }
  await client.removeDuplicateAccountStudentAlertsTools(toolOptions).catch(() => null);

  return {
    ok: true as const,
    accounts,
    courses: 0,
    installed: accounts,
    failed: [] as Array<{ id: number; name?: string; reason: string }>,
    usedFallback: false,
    note:
      accounts > 0
        ? "Student Alerts is installed once on the Canvas account. Teachers can add it from Modules → External Tool."
        : accountErrors[0] ||
          "Could not install Student Alerts on the Canvas account. Use a Canvas admin API token.",
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

const CLEANUP_JOB_ID = "__student_alerts_remove_unauthorized__";
const CLEANUP_DEADLINE_MS = 50_000;

type CleanupJob = {
  courses: Array<{ id: number; name?: string }>;
  cursor: number;
  listedAt: number;
  usedFallback: boolean;
  accountErrors: string[];
  backfilled: boolean;
};

async function loadCleanupJob(): Promise<CleanupJob | null> {
  try {
    const record = await prisma.courseAlertConfig.findUnique({
      where: { canvasCourseId: CLEANUP_JOB_ID },
    });
    if (!record?.bannerMessage) return null;
    const parsed = JSON.parse(record.bannerMessage) as CleanupJob;
    if (!Array.isArray(parsed.courses) || parsed.courses.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function saveCleanupJob(job: CleanupJob) {
  try {
    await prisma.courseAlertConfig.upsert({
      where: { canvasCourseId: CLEANUP_JOB_ID },
      create: {
        canvasCourseId: CLEANUP_JOB_ID,
        courseName: "Unauthorized Home embed cleanup",
        bannerMessage: JSON.stringify(job),
      },
      update: {
        courseName: "Unauthorized Home embed cleanup",
        bannerMessage: JSON.stringify(job),
      },
    });
  } catch (error) {
    console.error("Could not persist Student Alerts cleanup progress:", error);
  }
}

export async function removeUnauthorizedHomeEmbeds(options?: {
  offset?: number;
  generation?: number;
  reset?: boolean;
}) {
  const startedAt = Date.now();
  const deadline = startedAt + CLEANUP_DEADLINE_MS;
  const generation = Math.max(0, Math.floor(options?.generation || 0));
  const requestedOffset = options?.offset;

  let job = await loadCleanupJob();
  if (options?.reset && job) {
    job.cursor = 0;
    job.listedAt = Date.now();
    await saveCleanupJob(job);
  }

  if (!job?.backfilled) {
    await backfillExistingConfigsAsHomeEnabled();
    if (job) {
      job.backfilled = true;
      await saveCleanupJob(job);
    }
  }

  const jobFresh = Boolean(job && Date.now() - (job?.listedAt || 0) < 6 * 60 * 60 * 1000);
  const jobInProgress = Boolean(jobFresh && job && job.cursor < job.courses.length);
  const jobJustFinished = Boolean(
    jobFresh && job && job.cursor >= job.courses.length && Date.now() - job.listedAt < 30 * 60 * 1000,
  );

  if (jobJustFinished && generation === 0 && (requestedOffset == null || requestedOffset === 0)) {
    return {
      ok: true as const,
      removed: 0,
      kept: 0,
      total: job!.courses.length,
      processedThrough: job!.courses.length,
      nextOffset: null,
      remaining: 0,
      failed: [] as Array<{ id: number; name?: string; reason: string }>,
      usedFallback: job!.usedFallback,
      accountErrors: job!.accountErrors,
      note: "Home alerts stay only in classes teachers turned on. Other classes have been cleaned up.",
    };
  }

  const client = createCanvasAdminClient();
  if (!job || !jobFresh || (!jobInProgress && generation === 0 && (requestedOffset == null || requestedOffset === 0))) {
    const listed = await client.listPublishedCourses();
    job = {
      courses: listed.courses.map((course) => ({ id: course.id, name: course.name })),
      cursor: 0,
      listedAt: Date.now(),
      usedFallback: listed.usedFallback,
      accountErrors: listed.accountErrors,
      backfilled: true,
    };
    await saveCleanupJob(job);
  }

  const enabledIds = await listHomeAlertsEnabledCourseIds();
  const courses = job.courses;
  const courseListErrors = [...job.accountErrors];
  const usedFallback = job.usedFallback;
  const offset = Math.max(
    0,
    Math.floor(
      requestedOffset != null && requestedOffset > 0
        ? requestedOffset
        : jobInProgress
          ? job.cursor
          : 0,
    ),
  );

  if (offset >= courses.length) {
    job.cursor = courses.length;
    await saveCleanupJob(job);
    return {
      ok: true as const,
      removed: 0,
      kept: enabledIds.size,
      total: courses.length,
      processedThrough: courses.length,
      nextOffset: null,
      remaining: 0,
      failed: [] as Array<{ id: number; name?: string; reason: string }>,
      usedFallback,
      accountErrors: courseListErrors,
      note:
        courses.length > 0
          ? "Home alerts stay only in classes teachers turned on."
          : "No live Canvas courses were found.",
    };
  }

  const failed: Array<{ id: number; name?: string; reason: string }> = [];
  let removed = 0;
  let kept = 0;
  let cursor = offset;

  if (Date.now() < deadline) {
    await mapPool(Array.from({ length: 6 }), 6, async () => {
      while (Date.now() < deadline) {
        const current = cursor;
        if (current >= courses.length) return;
        cursor += 1;
        const course = courses[current];
        if (!course) return;
        const courseId = String(course.id);
        if (enabledIds.has(courseId)) {
          kept += 1;
          continue;
        }
        try {
          const result = await client.removeEmbedFromFrontPage(courseId);
          if (result.removed) removed += 1;
        } catch (error) {
          failed.push({
            id: course.id,
            name: course.name,
            reason: error instanceof Error ? error.message : "Could not remove the Home embed.",
          });
        }
      }
    });
  }

  job.cursor = cursor;
  await saveCleanupJob(job);

  const nextOffset = cursor < courses.length ? cursor : null;
  if (nextOffset != null && nextOffset > offset && generation < 200) {
    continueUnauthorizedEmbedCleanup(nextOffset, generation + 1);
  } else if (nextOffset != null && nextOffset === offset && generation < 200 && Date.now() >= deadline) {
    continueUnauthorizedEmbedCleanup(nextOffset, generation + 1);
  }

  const remaining = Math.max(0, courses.length - cursor);
  return {
    ok: true as const,
    removed,
    kept,
    total: courses.length,
    processedThrough: cursor,
    nextOffset,
    remaining,
    failed,
    usedFallback,
    accountErrors: courseListErrors,
    note:
      remaining > 0
        ? `Removed Student Alerts from ${removed} class${removed === 1 ? "" : "es"} that teachers did not turn on (${cursor} of ${courses.length}). Continuing automatically.`
        : `Home alerts now stay only in classes teachers turned on. Removed leftover embeds from ${removed} class${removed === 1 ? "" : "es"}.`,
  };
}

function continueUnauthorizedEmbedCleanup(nextOffset: number, generation: number) {
  const origin = getAppOrigin();
  if (!origin) return;
  const url = `${origin}/api/course-alerts/enable-all-courses?offset=${nextOffset}&generation=${generation}`;
  const kick = () =>
    void fetch(url, { method: "GET", cache: "no-store" }).catch((error) => {
      console.error("Student Alerts cleanup continuation failed:", error);
    });
  try {
    after(kick);
  } catch {
    kick();
  }
}

let lastCleanupAt = 0;
const CLEANUP_COOLDOWN_MS = 2 * 60 * 1000;

export function scheduleUnauthorizedEmbedCleanup() {
  const now = Date.now();
  if (now - lastCleanupAt < CLEANUP_COOLDOWN_MS) return;
  lastCleanupAt = now;
  const origin = getAppOrigin();
  if (origin) {
    void fetch(`${origin}/api/course-alerts/enable-all-courses`, {
      method: "GET",
      cache: "no-store",
    }).catch((error) => {
      lastCleanupAt = 0;
      console.error("Unauthorized Home embed cleanup failed:", error);
    });
    return;
  }
  void removeUnauthorizedHomeEmbeds().catch((error) => {
    lastCleanupAt = 0;
    console.error("Unauthorized Home embed cleanup failed:", error);
  });
}

/** @deprecated School-wide Home enable is no longer allowed. */
export async function enableStudentAlertsInAllCourses(options?: {
  offset?: number;
  generation?: number;
  reset?: boolean;
}) {
  return removeUnauthorizedHomeEmbeds(options);
}

export function scheduleSchoolWideEnable() {
  scheduleUnauthorizedEmbedCleanup();
}

