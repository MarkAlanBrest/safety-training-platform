import type { createCanvasClient } from "@/lib/canvas/client";
import type {
  CanvasAlert,
  CanvasAlertSummary,
  CanvasEnrollment,
  CanvasMissingSubmission,
  CanvasPlannerItem,
  CanvasUser,
} from "@/lib/canvas/types";

const LOW_GRADE_THRESHOLD = Number(process.env.CANVAS_LOW_GRADE_THRESHOLD || 70);
const DUE_SOON_HOURS = Number(process.env.CANVAS_DUE_SOON_HOURS || 48);

type CanvasClient = ReturnType<typeof createCanvasClient>;

function courseNameFor(enrollment: CanvasEnrollment) {
  return enrollment.course?.name || `Course ${enrollment.course_id}`;
}

function courseCodeFor(enrollment: CanvasEnrollment) {
  return enrollment.course?.course_code || "";
}

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

function buildEnrollmentMap(enrollments: CanvasEnrollment[]) {
  const map = new Map<number, CanvasEnrollment>();
  for (const enrollment of enrollments) {
    map.set(enrollment.course_id, enrollment);
  }
  return map;
}

function missingAlerts(
  missing: CanvasMissingSubmission[],
  enrollmentMap: Map<number, CanvasEnrollment>,
): CanvasAlert[] {
  return missing.map((assignment) => {
    const enrollment = enrollmentMap.get(assignment.course_id);
    const courseName = enrollment ? courseNameFor(enrollment) : `Course ${assignment.course_id}`;
    const hours = hoursUntil(assignment.due_at);
    const severity = hours !== null && hours < 0 ? "critical" : "critical";

    return {
      id: `missing-${assignment.id}`,
      severity,
      title: assignment.name,
      message: `Missing submission. ${formatDueMessage(assignment.due_at)}`,
      courseName,
      courseId: assignment.course_id,
      dueAt: assignment.due_at,
      link: assignment.html_url,
      kind: "missing",
    };
  });
}

function dueSoonAlerts(
  plannerItems: CanvasPlannerItem[],
  enrollmentMap: Map<number, CanvasEnrollment>,
  missingIds: Set<number>,
): CanvasAlert[] {
  const alerts: CanvasAlert[] = [];

  for (const item of plannerItems) {
    if (item.plannable_type !== "assignment") continue;
    if (missingIds.has(item.plannable.id)) continue;

    const dueAt = item.plannable.due_at || null;
    const hours = hoursUntil(dueAt);
    if (hours === null || hours < 0 || hours > DUE_SOON_HOURS) continue;

    const courseId = item.plannable.course_id || 0;
    const enrollment = enrollmentMap.get(courseId);
    const courseName = enrollment ? courseNameFor(enrollment) : item.context_name || `Course ${courseId}`;
    const severity = hours <= 24 ? "warning" : "info";

    alerts.push({
      id: `due-${item.plannable.id}`,
      severity,
      title: item.plannable.title,
      message: `Coming due soon. ${formatDueMessage(dueAt)}`,
      courseName,
      courseId,
      dueAt,
      link: item.html_url || item.plannable.html_url || "#",
      kind: "due_soon",
    });
  }

  return alerts;
}

function gradeAlerts(
  enrollments: CanvasEnrollment[],
  canvasBaseUrl: string,
): CanvasAlert[] {
  const alerts: CanvasAlert[] = [];

  for (const enrollment of enrollments) {
    const score =
      enrollment.grades?.current_score ??
      enrollment.computed_current_score ??
      enrollment.grades?.final_score ??
      enrollment.computed_final_score ??
      null;
    if (score === null || score >= LOW_GRADE_THRESHOLD) continue;

    const grade =
      enrollment.grades?.current_grade ||
      enrollment.grades?.final_grade ||
      null;
    const courseName = courseNameFor(enrollment);
    const severity = score < 60 ? "critical" : "warning";

    alerts.push({
      id: `grade-${enrollment.course_id}`,
      severity,
      title: `Low grade in ${courseName}`,
      message: `Current score is ${score.toFixed(1)}%${grade ? ` (${grade})` : ""}.`,
      courseName,
      courseId: enrollment.course_id,
      dueAt: null,
      link: `${canvasBaseUrl}/courses/${enrollment.course_id}/grades`,
      kind: "low_grade",
      score,
      grade,
    });
  }

  return alerts;
}

function sortAlerts(alerts: CanvasAlert[]) {
  const severityRank = { critical: 0, warning: 1, info: 2 };
  return [...alerts].sort((a, b) => {
    const severityDiff = severityRank[a.severity] - severityRank[b.severity];
    if (severityDiff !== 0) return severityDiff;
    const aDue = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
    const bDue = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
    return aDue - bDue;
  });
}

export async function buildCanvasAlertSummary(
  client: CanvasClient,
  user: CanvasUser,
): Promise<CanvasAlertSummary> {
  const [enrollments, missing, plannerItems] = await Promise.all([
    client.getStudentEnrollments(),
    client.getMissingSubmissions(),
    client.getPlannerItems(),
  ]);

  const enrollmentMap = buildEnrollmentMap(enrollments);
  const missingIds = new Set(missing.map((item) => item.id));

  const alerts = sortAlerts([
    ...missingAlerts(missing, enrollmentMap),
    ...dueSoonAlerts(plannerItems, enrollmentMap, missingIds),
    ...gradeAlerts(enrollments, client.baseUrl),
  ]);

  const counts = {
    critical: alerts.filter((alert) => alert.severity === "critical").length,
    warning: alerts.filter((alert) => alert.severity === "warning").length,
    info: alerts.filter((alert) => alert.severity === "info").length,
    missing: alerts.filter((alert) => alert.kind === "missing").length,
    dueSoon: alerts.filter((alert) => alert.kind === "due_soon").length,
    lowGrades: alerts.filter((alert) => alert.kind === "low_grade").length,
  };

  return {
    user,
    alerts,
    enrollments: enrollments.map((enrollment) => ({
      courseId: enrollment.course_id,
      courseName: courseNameFor(enrollment),
      courseCode: courseCodeFor(enrollment),
      currentScore: enrollment.grades?.current_score ?? enrollment.computed_current_score ?? null,
      currentGrade: enrollment.grades?.current_grade ?? null,
      finalScore: enrollment.grades?.final_score ?? enrollment.computed_final_score ?? null,
      finalGrade: enrollment.grades?.final_grade ?? null,
    })),
    counts,
    fetchedAt: new Date().toISOString(),
  };
}
