import { prisma } from "@/lib/prisma";
import {
  DEFAULT_COURSE_ALERT_CONFIG,
  normalizeCourseAlertConfigInput,
  type CourseAlertConfigInput,
  type CourseAlertConfigView,
} from "@/lib/course-alerts/config";

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

  return {
    canvasCourseId: record.canvasCourseId,
    courseName: record.courseName,
    missingWorkDays: record.missingWorkDays,
    lowGradeThreshold: record.lowGradeThreshold,
    bannerMessage: record.bannerMessage,
    showMissing: record.showMissing,
    showLowGrades: record.showLowGrades,
    updatedAt: record.updatedAt.toISOString(),
  };
}

export async function saveCourseAlertConfig(
  canvasCourseId: string,
  input: Partial<CourseAlertConfigInput>,
  updatedBy?: string | null,
) {
  const normalized = normalizeCourseAlertConfigInput(input);

  const record = await prisma.courseAlertConfig.upsert({
    where: { canvasCourseId },
    create: {
      canvasCourseId,
      courseName: normalized.courseName ?? null,
      missingWorkDays: normalized.missingWorkDays,
      lowGradeThreshold: normalized.lowGradeThreshold,
      bannerMessage: normalized.bannerMessage,
      showMissing: normalized.showMissing,
      showLowGrades: normalized.showLowGrades,
      updatedBy: updatedBy || null,
    },
    update: {
      courseName: normalized.courseName ?? undefined,
      missingWorkDays: normalized.missingWorkDays,
      lowGradeThreshold: normalized.lowGradeThreshold,
      bannerMessage: normalized.bannerMessage,
      showMissing: normalized.showMissing,
      showLowGrades: normalized.showLowGrades,
      updatedBy: updatedBy || null,
    },
  });

  return {
    canvasCourseId: record.canvasCourseId,
    courseName: record.courseName,
    missingWorkDays: record.missingWorkDays,
    lowGradeThreshold: record.lowGradeThreshold,
    bannerMessage: record.bannerMessage,
    showMissing: record.showMissing,
    showLowGrades: record.showLowGrades,
    updatedAt: record.updatedAt.toISOString(),
  } satisfies CourseAlertConfigView;
}
