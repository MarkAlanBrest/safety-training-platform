import { prisma } from "@/lib/prisma";
import {
  DEFAULT_COURSE_ALERT_CONFIG,
  normalizeCourseAlertConfigInput,
  type CourseAlertConfigInput,
  type CourseAlertConfigView,
} from "@/lib/course-alerts/config";

function toConfigView(
  canvasCourseId: string,
  record: {
    courseName: string | null;
    missingWorkDays: number;
    lowGradeThreshold: number;
    assignmentLowGradePercent?: number;
    loginInactivityDays?: number;
    dueSoonHours?: number;
    bannerMessage: string | null;
    missingMessage?: string | null;
    assignmentLowGradeMessage?: string | null;
    loginInactivityMessage?: string | null;
    overallLowGradeMessage?: string | null;
    dueSoonMessage?: string | null;
    showMissing: boolean;
    showLowGrades: boolean;
    showAssignmentLowGrades?: boolean;
    showLoginInactivity?: boolean;
    showDueSoon?: boolean;
    homeEmbedEnabled?: boolean;
    updatedAt: Date;
  },
): CourseAlertConfigView {
  const normalized = normalizeCourseAlertConfigInput({
    courseName: record.courseName,
    missingWorkDays: record.missingWorkDays,
    lowGradeThreshold: record.lowGradeThreshold,
    assignmentLowGradePercent: record.assignmentLowGradePercent,
    loginInactivityDays: record.loginInactivityDays,
    dueSoonHours: record.dueSoonHours,
    bannerMessage: record.bannerMessage,
    missingMessage: record.missingMessage,
    assignmentLowGradeMessage: record.assignmentLowGradeMessage,
    loginInactivityMessage: record.loginInactivityMessage,
    overallLowGradeMessage: record.overallLowGradeMessage,
    dueSoonMessage: record.dueSoonMessage,
    showMissing: record.showMissing,
    showLowGrades: record.showLowGrades,
    showAssignmentLowGrades: record.showAssignmentLowGrades,
    showLoginInactivity: record.showLoginInactivity,
    showDueSoon: record.showDueSoon,
    homeEmbedEnabled: record.homeEmbedEnabled,
  });

  return {
    canvasCourseId,
    ...normalized,
    courseName: normalized.courseName ?? record.courseName,
    updatedAt: record.updatedAt.toISOString(),
  };
}

export async function getCourseAlertConfig(canvasCourseId: string): Promise<CourseAlertConfigView> {
  const record = await prisma.courseAlertConfig.findUnique({
    where: { canvasCourseId },
  });

  if (!record) {
    return {
      canvasCourseId,
      courseName: null,
      ...DEFAULT_COURSE_ALERT_CONFIG,
      updatedAt: new Date(0).toISOString(),
    };
  }

  return toConfigView(canvasCourseId, record);
}

export async function saveCourseAlertConfig(
  canvasCourseId: string,
  input: Partial<CourseAlertConfigInput>,
  updatedBy?: string | null,
) {
  const existing = await prisma.courseAlertConfig.findUnique({
    where: { canvasCourseId },
  });
  const normalized = normalizeCourseAlertConfigInput({
    ...(existing
      ? {
          courseName: existing.courseName,
          missingWorkDays: existing.missingWorkDays,
          lowGradeThreshold: existing.lowGradeThreshold,
          assignmentLowGradePercent: existing.assignmentLowGradePercent,
          loginInactivityDays: existing.loginInactivityDays,
          dueSoonHours: existing.dueSoonHours,
          bannerMessage: existing.bannerMessage,
          missingMessage: existing.missingMessage,
          assignmentLowGradeMessage: existing.assignmentLowGradeMessage,
          loginInactivityMessage: existing.loginInactivityMessage,
          overallLowGradeMessage: existing.overallLowGradeMessage,
          dueSoonMessage: existing.dueSoonMessage,
          showMissing: existing.showMissing,
          showLowGrades: existing.showLowGrades,
          showAssignmentLowGrades: existing.showAssignmentLowGrades,
          showLoginInactivity: existing.showLoginInactivity,
          showDueSoon: existing.showDueSoon,
          homeEmbedEnabled: existing.homeEmbedEnabled,
        }
      : {}),
    ...input,
  });

  const record = await prisma.courseAlertConfig.upsert({
    where: { canvasCourseId },
    create: {
      canvasCourseId,
      courseName: normalized.courseName ?? null,
      missingWorkDays: normalized.missingWorkDays,
      lowGradeThreshold: normalized.lowGradeThreshold,
      assignmentLowGradePercent: normalized.assignmentLowGradePercent,
      loginInactivityDays: normalized.loginInactivityDays,
      dueSoonHours: normalized.dueSoonHours,
      bannerMessage: normalized.bannerMessage,
      missingMessage: normalized.missingMessage,
      assignmentLowGradeMessage: normalized.assignmentLowGradeMessage,
      loginInactivityMessage: normalized.loginInactivityMessage,
      overallLowGradeMessage: normalized.overallLowGradeMessage,
      dueSoonMessage: normalized.dueSoonMessage,
      showMissing: normalized.showMissing,
      showLowGrades: normalized.showLowGrades,
      showAssignmentLowGrades: normalized.showAssignmentLowGrades,
      showLoginInactivity: normalized.showLoginInactivity,
      showDueSoon: normalized.showDueSoon,
      homeEmbedEnabled: normalized.homeEmbedEnabled === true,
      updatedBy: updatedBy || null,
    },
    update: {
      courseName: normalized.courseName ?? undefined,
      missingWorkDays: normalized.missingWorkDays,
      lowGradeThreshold: normalized.lowGradeThreshold,
      assignmentLowGradePercent: normalized.assignmentLowGradePercent,
      loginInactivityDays: normalized.loginInactivityDays,
      dueSoonHours: normalized.dueSoonHours,
      bannerMessage: normalized.bannerMessage,
      missingMessage: normalized.missingMessage,
      assignmentLowGradeMessage: normalized.assignmentLowGradeMessage,
      loginInactivityMessage: normalized.loginInactivityMessage,
      overallLowGradeMessage: normalized.overallLowGradeMessage,
      dueSoonMessage: normalized.dueSoonMessage,
      showMissing: normalized.showMissing,
      showLowGrades: normalized.showLowGrades,
      showAssignmentLowGrades: normalized.showAssignmentLowGrades,
      showLoginInactivity: normalized.showLoginInactivity,
      showDueSoon: normalized.showDueSoon,
      homeEmbedEnabled: normalized.homeEmbedEnabled === true,
      updatedBy: updatedBy || null,
    },
  });

  return toConfigView(canvasCourseId, record);
}

function isRealCourseId(canvasCourseId: string) {
  return Boolean(canvasCourseId) && !canvasCourseId.startsWith("__");
}

export async function isCourseHomeAlertsEnabled(canvasCourseId: string) {
  if (!isRealCourseId(canvasCourseId)) return false;
  const record = await prisma.courseAlertConfig.findUnique({
    where: { canvasCourseId },
    select: { homeEmbedEnabled: true },
  });
  return record?.homeEmbedEnabled === true;
}

export async function setCourseHomeAlertsEnabled(canvasCourseId: string, enabled: boolean) {
  if (!isRealCourseId(canvasCourseId)) return;
  await prisma.courseAlertConfig.upsert({
    where: { canvasCourseId },
    create: {
      canvasCourseId,
      homeEmbedEnabled: enabled,
    },
    update: {
      homeEmbedEnabled: enabled,
    },
  });
}

export async function listHomeAlertsEnabledCourseIds() {
  const records = await prisma.courseAlertConfig.findMany({
    where: { homeEmbedEnabled: true },
    select: { canvasCourseId: true },
  });
  return new Set(records.map((record) => record.canvasCourseId).filter(isRealCourseId));
}

export async function backfillExistingConfigsAsHomeEnabled() {
  await prisma.courseAlertConfig.updateMany({
    where: {
      homeEmbedEnabled: false,
      NOT: { canvasCourseId: { startsWith: "__" } },
    },
    data: { homeEmbedEnabled: true },
  });
}

