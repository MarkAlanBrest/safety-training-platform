import { after } from "next/server";
import { getAppOrigin, getConfiguredLtiClientId } from "@/lib/canvas/config";
import { createCanvasAdminClient } from "@/lib/canvas/admin-client";
import {
  HOME_EMBED_BANNER_HEIGHT_PX,
  HOME_EMBED_VERSION,
} from "@/lib/canvas/home-embed-constants";
import { prisma } from "@/lib/prisma";

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
    const client = createCanvasAdminClient();
    const access = await client.getCourseAccess(canvasCourseId);
    if (!access.ok) return { refreshed: false as const };

    const status = await client.getFrontPageEmbedStatus(canvasCourseId);
    const hasCanvasNestedFrame = Boolean(
      status.frontPageBody?.includes("/external_tools/") ||
        status.frontPageBody?.includes("instructure.com/courses/"),
    );
    const hasDirectHomeEmbed = Boolean(status.frontPageBody?.includes("/canvas/home-embed"));
    if (
      status.hasStudentAlertsEmbed &&
      status.embedVersion === HOME_EMBED_VERSION &&
      hasDirectHomeEmbed &&
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

const ENABLE_JOB_ID = "__student_alerts_enable_all__";
const ENABLE_DEADLINE_MS = 50_000;

type EnableJob = {
  courses: Array<{ id: number; name?: string }>;
  cursor: number;
  listedAt: number;
  usedFallback: boolean;
  accountErrors: string[];
};

async function loadEnableJob(): Promise<EnableJob | null> {
  try {
    const record = await prisma.courseAlertConfig.findUnique({
      where: { canvasCourseId: ENABLE_JOB_ID },
    });
    if (!record?.bannerMessage) return null;
    const parsed = JSON.parse(record.bannerMessage) as EnableJob;
    if (!Array.isArray(parsed.courses) || parsed.courses.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function saveEnableJob(job: EnableJob) {
  try {
    await prisma.courseAlertConfig.upsert({
      where: { canvasCourseId: ENABLE_JOB_ID },
      create: {
        canvasCourseId: ENABLE_JOB_ID,
        courseName: "School-wide enable progress",
        bannerMessage: JSON.stringify(job),
      },
      update: {
        courseName: "School-wide enable progress",
        bannerMessage: JSON.stringify(job),
      },
    });
  } catch (error) {
    console.error("Could not persist Student Alerts enable progress:", error);
  }
}

export async function enableStudentAlertsInAllCourses(options?: {
  offset?: number;
  generation?: number;
  reset?: boolean;
}) {
  const startedAt = Date.now();
  const deadline = startedAt + ENABLE_DEADLINE_MS;
  const generation = Math.max(0, Math.floor(options?.generation || 0));
  const requestedOffset = options?.offset;

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

  let job = await loadEnableJob();
  if (options?.reset && job) {
    job.cursor = 0;
    job.listedAt = Date.now();
    await saveEnableJob(job);
  }
  const jobFresh = Boolean(job && Date.now() - (job?.listedAt || 0) < 6 * 60 * 60 * 1000);
  const jobInProgress = Boolean(jobFresh && job && job.cursor < job.courses.length);
  const jobJustFinished = Boolean(
    jobFresh && job && job.cursor >= job.courses.length && Date.now() - job.listedAt < 30 * 60 * 1000,
  );

  if (jobJustFinished && generation === 0 && (requestedOffset == null || requestedOffset === 0)) {
    return {
      ok: true as const,
      enabled: 0,
      installed: 0,
      accounts: 1,
      total: job!.courses.length,
      processedThrough: job!.courses.length,
      nextOffset: null,
      remaining: 0,
      failed: [] as Array<{ id: number; name?: string; reason: string }>,
      usedFallback: job!.usedFallback,
      accountErrors: job!.accountErrors,
      note: `Student Alerts is on in ${job!.courses.length} live class${
        job!.courses.length === 1 ? "" : "es"
      }. Each class keeps its own settings.`,
    };
  }

  if (!job || !jobFresh || (!jobInProgress && generation === 0 && (requestedOffset == null || requestedOffset === 0))) {
    const listed = await client.listPublishedCourses();
    job = {
      courses: listed.courses.map((course) => ({ id: course.id, name: course.name })),
      cursor: 0,
      listedAt: Date.now(),
      usedFallback: listed.usedFallback,
      accountErrors: listed.accountErrors,
    };
    await saveEnableJob(job);
  }

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
    await saveEnableJob(job);
    return {
      ok: true as const,
      enabled: 0,
      installed: 0,
      accounts: 1,
      total: courses.length,
      processedThrough: courses.length,
      nextOffset: null,
      remaining: 0,
      failed: [] as Array<{ id: number; name?: string; reason: string }>,
      usedFallback,
      accountErrors: courseListErrors,
      note:
        courses.length > 0
          ? `Student Alerts is already enabled across ${courses.length} live class${courses.length === 1 ? "" : "es"}. Each class keeps its own settings.`
          : "No live Canvas courses were found.",
    };
  }

  const failed: Array<{ id: number; name?: string; reason: string }> = [];
  let enabled = 0;
  let cursor = offset;

  if (Date.now() < deadline) {
    await mapPool(Array.from({ length: 6 }), 6, async () => {
      while (Date.now() < deadline) {
        const current = cursor;
        if (current >= courses.length) return;
        cursor += 1;
        const course = courses[current];
        if (!course) return;
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
      }
    });
  }

  job.cursor = cursor;
  await saveEnableJob(job);

  const nextOffset = cursor < courses.length ? cursor : null;
  if (nextOffset != null && nextOffset > offset && generation < 200) {
    continueSchoolWideEnable(nextOffset, generation + 1);
  } else if (nextOffset != null && nextOffset === offset && generation < 200 && Date.now() >= deadline) {
    continueSchoolWideEnable(nextOffset, generation + 1);
  }

  const remaining = Math.max(0, courses.length - cursor);
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
    processedThrough: cursor,
    nextOffset,
    remaining,
    failed,
    usedFallback,
    accountErrors: courseListErrors,
    note:
      fallbackWarning ||
      (remaining > 0
        ? `Student Alerts is on in ${enabled} more class${enabled === 1 ? "" : "es"} (${cursor} of ${courses.length}). Continuing automatically. Each class keeps its own settings.`
        : enabled > 0 || offset > 0
          ? `Student Alerts is on in ${cursor} class${cursor === 1 ? "" : "es"}. Each class keeps its own settings.`
          : "Could not turn on Student Alerts in other classes."),
  };
}

function continueSchoolWideEnable(nextOffset: number, generation: number) {
  const origin = getAppOrigin();
  if (!origin) return;
  const url = `${origin}/api/course-alerts/enable-all-courses?offset=${nextOffset}&generation=${generation}`;
  const kick = () =>
    void fetch(url, { method: "GET", cache: "no-store" }).catch((error) => {
      console.error("Student Alerts enable continuation failed:", error);
    });
  try {
    after(kick);
  } catch {
    kick();
  }
}

let lastSchoolWideEnableAt = 0;
const SCHOOL_WIDE_COOLDOWN_MS = 2 * 60 * 1000;

export function scheduleSchoolWideEnable() {
  const now = Date.now();
  if (now - lastSchoolWideEnableAt < SCHOOL_WIDE_COOLDOWN_MS) return;
  lastSchoolWideEnableAt = now;
  const origin = getAppOrigin();
  if (origin) {
    void fetch(`${origin}/api/course-alerts/enable-all-courses`, {
      method: "GET",
      cache: "no-store",
    }).catch((error) => {
      lastSchoolWideEnableAt = 0;
      console.error("School-wide Student Alerts enable failed:", error);
    });
    return;
  }
  void enableStudentAlertsInAllCourses().catch((error) => {
    lastSchoolWideEnableAt = 0;
    console.error("School-wide Student Alerts enable failed:", error);
  });
}

