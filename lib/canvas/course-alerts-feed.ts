import type { createCanvasClient } from "@/lib/canvas/client";
import type { CanvasAlert, CanvasEnrollment, CanvasUser } from "@/lib/canvas/types";
import type { CourseAlertConfigInput } from "@/lib/course-alerts/config";
import { getStudentDisplayName } from "@/lib/canvas/home-embed-messages";
import {
  DEFAULT_ALERT_MESSAGES,
  formatAssignmentList,
  renderAlertTemplate,
} from "@/lib/course-alerts/messages";

type CanvasClient = ReturnType<typeof createCanvasClient>;

function hoursUntil(dateString: string | null | undefined) {
  if (!dateString) return null;
  const due = new Date(dateString).getTime();
  if (Number.isNaN(due)) return null;
  return (due - Date.now()) / (1000 * 60 * 60);
}

function isWithinMissingWindow(dueAt: string | null, missingWorkDays: number) {
  if (!dueAt) return true;
  const due = new Date(dueAt).getTime();
  if (Number.isNaN(due)) return true;
  const cutoff = Date.now() - missingWorkDays * 24 * 60 * 60 * 1000;
  return due >= cutoff;
}

function findEnrollment(enrollments: CanvasEnrollment[], courseId: number) {
  return enrollments.find((enrollment) => enrollment.course_id === courseId) || null;
}

function daysSince(dateString: string | null | undefined) {
  if (!dateString) return null;
  const time = new Date(dateString).getTime();
  if (Number.isNaN(time)) return null;
  return (Date.now() - time) / (1000 * 60 * 60 * 24);
}

function assignmentPercent(score: number, pointsPossible: number | null | undefined) {
  if (!pointsPossible || pointsPossible <= 0) return score === 0 ? 0 : null;
  return (score / pointsPossible) * 100;
}

export async function buildCourseScopedAlerts(
  client: CanvasClient,
  user: CanvasUser,
  canvasCourseId: string,
  config: CourseAlertConfigInput,
) {
  const courseId = Number(canvasCourseId);
  if (!Number.isFinite(courseId)) {
    return { user, alerts: [] as CanvasAlert[], fetchedAt: new Date().toISOString() };
  }

  const studentName = getStudentDisplayName(user.short_name || user.name);
  const [enrollments, missing, assignments] = await Promise.all([
    client.getStudentEnrollments(),
    client.getMissingSubmissions().catch(() => []),
    client.getCourseAssignments(courseId).catch(() => []),
  ]);

  const enrollment = findEnrollment(enrollments, courseId);
  const courseName = enrollment?.course?.name || `Course ${courseId}`;
  const alerts: CanvasAlert[] = [];
  const templateVarsBase = {
    name: studentName,
    days: config.missingWorkDays,
    threshold: config.lowGradeThreshold,
    score: "",
    assignments: "",
  };

  const lowGradeAssignmentIds = new Set<number>();
  if (config.showAssignmentLowGrades) {
    const lowNames: string[] = [];
    for (const assignment of assignments) {
      if (assignment.published === false) continue;
      const submission = assignment.submission;
      if (!submission || submission.excused) continue;
      if (submission.score === null || submission.score === undefined) continue;

      const percent = assignmentPercent(submission.score, assignment.points_possible);
      const isZero = submission.score === 0;
      const isLowPercent = percent !== null && percent < config.assignmentLowGradePercent;
      if (!isZero && !isLowPercent) continue;

      lowGradeAssignmentIds.add(assignment.id);
      lowNames.push(assignment.name);
    }

    if (lowNames.length) {
      alerts.push({
        id: `assignment-low-${courseId}`,
        severity: "critical",
        title: "Low assignment grades",
        message: renderAlertTemplate(
          config.assignmentLowGradeMessage,
          DEFAULT_ALERT_MESSAGES.assignmentLowGrade,
          { ...templateVarsBase, assignments: formatAssignmentList(lowNames) },
        ),
        courseName,
        courseId,
        dueAt: null,
        link: `${client.baseUrl}/courses/${courseId}/grades`,
        kind: "assignment_low_grade",
      });
    }
  }

  if (config.showMissing) {
    const missingNames: string[] = [];
    for (const assignment of missing) {
      if (assignment.course_id !== courseId) continue;
      if (lowGradeAssignmentIds.has(assignment.id)) continue;
      if (!isWithinMissingWindow(assignment.due_at, config.missingWorkDays)) continue;
      missingNames.push(assignment.name);
    }

    if (missingNames.length) {
      alerts.push({
        id: `missing-${courseId}`,
        severity: "critical",
        title: "Missing assignments",
        message: renderAlertTemplate(config.missingMessage, DEFAULT_ALERT_MESSAGES.missing, {
          ...templateVarsBase,
          days: config.missingWorkDays,
          assignments: formatAssignmentList(missingNames),
        }),
        courseName,
        courseId,
        dueAt: null,
        link: `${client.baseUrl}/courses/${courseId}/grades`,
        kind: "missing",
      });
    }
  }

  if (config.showDueSoon) {
    const dueSoonNames: string[] = [];
    for (const assignment of assignments) {
      if (assignment.published === false) continue;
      const hours = hoursUntil(assignment.due_at);
      if (hours === null || hours < 0 || hours > config.dueSoonHours) continue;
      const submission = assignment.submission;
      if (submission?.submitted_at || submission?.workflow_state === "submitted") continue;
      if (lowGradeAssignmentIds.has(assignment.id)) continue;
      dueSoonNames.push(assignment.name);
    }

    if (dueSoonNames.length) {
      alerts.push({
        id: `due-soon-${courseId}`,
        severity: "warning",
        title: "Assignments due soon",
        message: renderAlertTemplate(config.dueSoonMessage, DEFAULT_ALERT_MESSAGES.dueSoon, {
          ...templateVarsBase,
          days: Math.ceil(config.dueSoonHours / 24),
          assignments: formatAssignmentList(dueSoonNames),
        }),
        courseName,
        courseId,
        dueAt: null,
        link: `${client.baseUrl}/courses/${courseId}`,
        kind: "due_soon",
      });
    }
  }

  if (config.showLowGrades && enrollment) {
    const score =
      enrollment.grades?.current_score ??
      enrollment.computed_current_score ??
      enrollment.grades?.final_score ??
      enrollment.computed_final_score ??
      null;

    if (score !== null && score < config.lowGradeThreshold) {
      const grade = enrollment.grades?.current_grade || enrollment.grades?.final_grade || null;
      alerts.push({
        id: `grade-${courseId}`,
        severity: score < 60 ? "critical" : "warning",
        title: "Overall grade",
        message: renderAlertTemplate(
          config.overallLowGradeMessage,
          DEFAULT_ALERT_MESSAGES.overallLowGrade,
          {
            ...templateVarsBase,
            threshold: config.lowGradeThreshold,
            score: score.toFixed(1),
          },
        ),
        courseName,
        courseId,
        dueAt: null,
        link: `${client.baseUrl}/courses/${courseId}/grades`,
        kind: "low_grade",
        score,
        grade,
      });
    }
  }

  if (config.showLoginInactivity) {
    const lastActivity = enrollment?.last_activity_at || user.last_login || null;
    const inactiveDays = daysSince(lastActivity);
    if (inactiveDays !== null && inactiveDays >= config.loginInactivityDays) {
      alerts.push({
        id: `login-${courseId}`,
        severity: "warning",
        title: "Login reminder",
        message: renderAlertTemplate(
          config.loginInactivityMessage,
          DEFAULT_ALERT_MESSAGES.loginInactivity,
          {
            ...templateVarsBase,
            days: config.loginInactivityDays,
          },
        ),
        courseName,
        courseId,
        dueAt: null,
        link: `${client.baseUrl}/courses/${courseId}`,
        kind: "login",
      });
    }
  }

  return {
    user,
    alerts,
    fetchedAt: new Date().toISOString(),
  };
}
