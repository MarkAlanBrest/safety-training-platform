export type CourseAlertConfigInput = {
  missingWorkDays: number;
  lowGradeThreshold: number;
  bannerMessage: string | null;
  showMissing: boolean;
  showLowGrades: boolean;
  courseName?: string | null;
};

export type CourseAlertConfigView = CourseAlertConfigInput & {
  canvasCourseId: string;
  courseName: string | null;
  updatedAt: string;
};

export const DEFAULT_COURSE_ALERT_CONFIG: CourseAlertConfigInput = {
  missingWorkDays: 14,
  lowGradeThreshold: 70,
  bannerMessage: null,
  showMissing: true,
  showLowGrades: true,
  courseName: null,
};

export function normalizeCourseAlertConfigInput(
  input: Partial<CourseAlertConfigInput>,
): CourseAlertConfigInput {
  const missingWorkDays = Number(input.missingWorkDays ?? DEFAULT_COURSE_ALERT_CONFIG.missingWorkDays);
  const lowGradeThreshold = Number(
    input.lowGradeThreshold ?? DEFAULT_COURSE_ALERT_CONFIG.lowGradeThreshold,
  );

  return {
    missingWorkDays: Number.isFinite(missingWorkDays)
      ? Math.min(90, Math.max(1, Math.round(missingWorkDays)))
      : DEFAULT_COURSE_ALERT_CONFIG.missingWorkDays,
    lowGradeThreshold: Number.isFinite(lowGradeThreshold)
      ? Math.min(100, Math.max(0, Math.round(lowGradeThreshold)))
      : DEFAULT_COURSE_ALERT_CONFIG.lowGradeThreshold,
    bannerMessage:
      typeof input.bannerMessage === "string" && input.bannerMessage.trim()
        ? input.bannerMessage.trim()
        : null,
    showMissing: input.showMissing !== false,
    showLowGrades: input.showLowGrades !== false,
    courseName:
      typeof input.courseName === "string" && input.courseName.trim()
        ? input.courseName.trim()
        : null,
  };
}

export function serializeCourseAlertCustomFields(config: CourseAlertConfigInput) {
  return {
    missing_work_days: String(config.missingWorkDays),
    low_grade_threshold: String(config.lowGradeThreshold),
    banner_message: config.bannerMessage || "",
    show_missing: config.showMissing ? "true" : "false",
    show_low_grades: config.showLowGrades ? "true" : "false",
  };
}

export function parseCourseAlertCustomFields(
  custom: Record<string, unknown> | null | undefined,
): Partial<CourseAlertConfigInput> {
  if (!custom) return {};

  return normalizeCourseAlertConfigInput({
    missingWorkDays: Number(custom.missing_work_days),
    lowGradeThreshold: Number(custom.low_grade_threshold),
    bannerMessage:
      typeof custom.banner_message === "string" ? custom.banner_message : undefined,
    showMissing: custom.show_missing !== "false",
    showLowGrades: custom.show_low_grades !== "false",
  });
}
