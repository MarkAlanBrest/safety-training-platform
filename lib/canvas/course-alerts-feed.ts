import type { createCanvasClient } from "@/lib/canvas/client";
import type { CanvasAlert, CanvasEnrollment, CanvasMissingSubmission, CanvasUser } from "@/lib/canvas/types";
import type { CourseAlertConfigInput } from "@/lib/course-alerts/config";

type CanvasClient = ReturnType<typeof createCanvasClient>;

function hoursUntil(dateString: string | null | undefined) {
  if (!dateString) return null;
  const due = new Date(dateString).getTime();
  if (Number.isNaN(due)) return null;
  return (due - Date.now()) / (1000 * 60 * 60);
}

function formatDueMessage(dueAt: string | null) {
  if (!dueAt) return "No due date listed.";
  const due = new Date(dueAt);
  const hours = hoursUntil(dueAt);
  if (hours === null) return `Due ${due.toLocaleString()}`;
  if (hours < 0) {
    const overdueHours = Math.abs(hours);
    if (overdueHours < 24) return `Overdue by ${Math.ceil(overdueHours)} hour(s).`;
    return `Overdue by ${Math.ceil(overdueHours / 24)} day(s).`;
  }
  if (hours < 24) return `Due in ${Math.ceil(hours)} hour(s).`;
  return `Due in ${Math.ceil(hours / 24)} day(s) on ${due.toLocaleString()}.`;
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

  const [enrollments, missing, plannerItems] = await Promise.all([
    client.getStudentEnrollments(),
    client.getMissingSubmissions(),
    client.getPlannerItems(),
  ]);

  const enrollment = findEnrollment(enrollments, courseId);
  const courseName = enrollment?.course?.name || `Course ${courseId}`;
  const alerts: CanvasAlert[] = [];

  if (config.showMissing) {
    for (const assignment of missing) {
      if (assignment.course_id !== courseId) continue;
      if (!isWithinMissingWindow(assignment.due_at, config.missingWorkDays)) continue;

      alerts.push({
        id: `missing-${assignment.id}`,
        severity: "critical",
        title: assignment.name,
        message: `Missing submission. ${formatDueMessage(assignment.due_at)}`,
        courseName,
        courseId,
        dueAt: assignment.due_at,
        link: assignment.html_url,
        kind: "missing",
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
        title: `Low grade in ${courseName}`,
        message: `Current score is ${score.toFixed(1)}%${grade ? ` (${grade})` : ""}.`,
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

  void plannerItems;

  return {
    user,
    alerts,
    fetchedAt: new Date().toISOString(),
  };
}
