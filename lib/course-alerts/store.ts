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
      updatedBy: updatedBy || null,
    },
  });

  return toConfigView(canvasCourseId, record);
}
