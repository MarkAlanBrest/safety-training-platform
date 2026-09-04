import { currentAlertMessage, DEFAULT_ALERT_MESSAGES } from "@/lib/course-alerts/messages";

export type CourseAlertConfigInput = {
  missingWorkDays: number;
  lowGradeThreshold: number;
  assignmentLowGradePercent: number;
  loginInactivityDays: number;
  dueSoonHours: number;
  bannerMessage: string | null;
  missingMessage: string | null;
  assignmentLowGradeMessage: string | null;
  loginInactivityMessage: string | null;
  overallLowGradeMessage: string | null;
  dueSoonMessage: string | null;
  showMissing: boolean;
  showLowGrades: boolean;
  showAssignmentLowGrades: boolean;
  showLoginInactivity: boolean;
  showDueSoon: boolean;
  homeEmbedEnabled?: boolean;
  courseName?: string | null;
  showMissingEmail?: boolean;
  missingEmailSubject?: string | null;
  missingEmailBody?: string | null;
  showAssignmentLowGradesEmail?: boolean;
  assignmentLowGradeEmailSubject?: string | null;
  assignmentLowGradeEmailBody?: string | null;
  showLowGradesEmail?: boolean;
  lowGradesEmailSubject?: string | null;
  lowGradesEmailBody?: string | null;
  showLoginInactivityEmail?: boolean;
  loginInactivityEmailSubject?: string | null;
  loginInactivityEmailBody?: string | null;
  showDueSoonEmail?: boolean;
  dueSoonEmailSubject?: string | null;
  dueSoonEmailBody?: string | null;
  emailFrequencyDays?: number;
};

export type CourseAlertConfigView = CourseAlertConfigInput & {
  canvasCourseId: string;
  courseName: string | null;
  updatedAt: string;
  lastEmailSentAt?: string | null;
};

export const DEFAULT_COURSE_ALERT_CONFIG: CourseAlertConfigInput = {
  missingWorkDays: 14,
  lowGradeThreshold: 70,
  assignmentLowGradePercent: 60,
  loginInactivityDays: 6,
  dueSoonHours: 6,
  bannerMessage: null,
  missingMessage: DEFAULT_ALERT_MESSAGES.missing,
  assignmentLowGradeMessage: DEFAULT_ALERT_MESSAGES.assignmentLowGrade,
  loginInactivityMessage: DEFAULT_ALERT_MESSAGES.loginInactivity,
  overallLowGradeMessage: DEFAULT_ALERT_MESSAGES.overallLowGrade,
  dueSoonMessage: DEFAULT_ALERT_MESSAGES.dueSoon,
  showMissing: true,
  showLowGrades: true,
  showAssignmentLowGrades: true,
  showLoginInactivity: true,
  showDueSoon: true,
  homeEmbedEnabled: false,
  courseName: null,
  showMissingEmail: false,
  missingEmailSubject: null,
  missingEmailBody: null,
  showAssignmentLowGradesEmail: false,
  assignmentLowGradeEmailSubject: null,
  assignmentLowGradeEmailBody: null,
  showLowGradesEmail: false,
  lowGradesEmailSubject: null,
  lowGradesEmailBody: null,
  showLoginInactivityEmail: false,
  loginInactivityEmailSubject: null,
  loginInactivityEmailBody: null,
  showDueSoonEmail: false,
  dueSoonEmailSubject: null,
  dueSoonEmailBody: null,
  emailFrequencyDays: 1,
};

function clampInt(value: unknown, fallback: number | undefined, min: number, max: number) {
  const defaultValue = fallback ?? min;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return defaultValue;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function optionalMessage(value: unknown, fallback: string | null | undefined) {
  const defaultValue = fallback ?? null;
  if (typeof value !== "string") return defaultValue;
  const trimmed = value.trim();
  if (!trimmed) return defaultValue;
  return currentAlertMessage(trimmed, defaultValue || trimmed);
}

function optionalText(value: unknown, fallback: string | null | undefined) {
  const defaultValue = fallback ?? null;
  if (typeof value !== "string") return defaultValue;
  const trimmed = value.trim();
  if (!trimmed) return defaultValue;
  return trimmed;
}

export function normalizeCourseAlertConfigInput(
  input: Partial<CourseAlertConfigInput>,
): CourseAlertConfigInput {
  return {
    missingWorkDays: clampInt(
      input.missingWorkDays,
      DEFAULT_COURSE_ALERT_CONFIG.missingWorkDays,
      1,
      90,
    ),
    lowGradeThreshold: clampInt(
      input.lowGradeThreshold,
      DEFAULT_COURSE_ALERT_CONFIG.lowGradeThreshold,
      0,
      100,
    ),
    assignmentLowGradePercent: clampInt(
      input.assignmentLowGradePercent,
      DEFAULT_COURSE_ALERT_CONFIG.assignmentLowGradePercent,
      0,
      100,
    ),
    loginInactivityDays: clampInt(
      input.loginInactivityDays,
      DEFAULT_COURSE_ALERT_CONFIG.loginInactivityDays,
      1,
      90,
    ),
    dueSoonHours: clampInt(input.dueSoonHours, DEFAULT_COURSE_ALERT_CONFIG.dueSoonHours, 1, 168),
    bannerMessage:
      typeof input.bannerMessage === "string" && input.bannerMessage.trim()
        ? input.bannerMessage.trim()
        : null,
    missingMessage: optionalMessage(input.missingMessage, DEFAULT_ALERT_MESSAGES.missing),
    assignmentLowGradeMessage: optionalMessage(
      input.assignmentLowGradeMessage,
      DEFAULT_ALERT_MESSAGES.assignmentLowGrade,
    ),
    loginInactivityMessage: optionalMessage(
      input.loginInactivityMessage,
      DEFAULT_ALERT_MESSAGES.loginInactivity,
    ),
    overallLowGradeMessage: optionalMessage(
      input.overallLowGradeMessage,
      DEFAULT_ALERT_MESSAGES.overallLowGrade,
    ),
    dueSoonMessage: optionalMessage(input.dueSoonMessage, DEFAULT_ALERT_MESSAGES.dueSoon),
    showMissing: input.showMissing !== false,
    showLowGrades: input.showLowGrades !== false,
    showAssignmentLowGrades: input.showAssignmentLowGrades !== false,
    showLoginInactivity: input.showLoginInactivity !== false,
    showDueSoon: input.showDueSoon !== false,
    showMissingEmail: input.showMissingEmail === true,
    missingEmailSubject: optionalText(input.missingEmailSubject, DEFAULT_COURSE_ALERT_CONFIG.missingEmailSubject),
    missingEmailBody: optionalText(input.missingEmailBody, DEFAULT_COURSE_ALERT_CONFIG.missingEmailBody),
    showAssignmentLowGradesEmail: input.showAssignmentLowGradesEmail === true,
    assignmentLowGradeEmailSubject: optionalText(input.assignmentLowGradeEmailSubject, DEFAULT_COURSE_ALERT_CONFIG.assignmentLowGradeEmailSubject),
    assignmentLowGradeEmailBody: optionalText(input.assignmentLowGradeEmailBody, DEFAULT_COURSE_ALERT_CONFIG.assignmentLowGradeEmailBody),
    showLowGradesEmail: input.showLowGradesEmail === true,
    lowGradesEmailSubject: optionalText(input.lowGradesEmailSubject, DEFAULT_COURSE_ALERT_CONFIG.lowGradesEmailSubject),
    lowGradesEmailBody: optionalText(input.lowGradesEmailBody, DEFAULT_COURSE_ALERT_CONFIG.lowGradesEmailBody),
    showLoginInactivityEmail: input.showLoginInactivityEmail === true,
    loginInactivityEmailSubject: optionalText(input.loginInactivityEmailSubject, DEFAULT_COURSE_ALERT_CONFIG.loginInactivityEmailSubject),
    loginInactivityEmailBody: optionalText(input.loginInactivityEmailBody, DEFAULT_COURSE_ALERT_CONFIG.loginInactivityEmailBody),
    showDueSoonEmail: input.showDueSoonEmail === true,
    dueSoonEmailSubject: optionalText(input.dueSoonEmailSubject, DEFAULT_COURSE_ALERT_CONFIG.dueSoonEmailSubject),
    dueSoonEmailBody: optionalText(input.dueSoonEmailBody, DEFAULT_COURSE_ALERT_CONFIG.dueSoonEmailBody),
    emailFrequencyDays: clampInt(input.emailFrequencyDays, DEFAULT_COURSE_ALERT_CONFIG.emailFrequencyDays, 1, 30),
    homeEmbedEnabled: input.homeEmbedEnabled === true,
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
