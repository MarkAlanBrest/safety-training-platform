import { prisma } from "@/lib/prisma";
import { getCourseAlertConfig } from "@/lib/course-alerts/store";
import { renderAlertIntro, renderAlertTemplate, formatAssignmentList, DEFAULT_ALERT_MESSAGES } from "@/lib/course-alerts/messages";
import { getCanvasServerConfig } from "@/lib/canvas/config";
import { createCanvasClient } from "@/lib/canvas/client";
import { buildCourseScopedAlerts } from "@/lib/canvas/course-alerts-feed";

export async function sendCourseAlertsByCanvas(canvasCourseId: string) {
  const config = await getCourseAlertConfig(canvasCourseId);
  const signups = await prisma.courseAlertSignup.findMany({ where: { canvasCourseId } });
  if (!signups.length) return { sent: 0, reason: "no signups" };

  const { baseUrl, apiToken } = getCanvasServerConfig();
  let sent = 0;
  for (const signup of signups) {
    const userIdNum = Number(signup.canvasUserId);
    if (!Number.isFinite(userIdNum)) continue;

    const client = createCanvasClient({ baseUrl, token: apiToken, userId: userIdNum });
    let user;
    try {
      user = await client.getUser();
    } catch (err) {
      console.error("Could not load user for sending alerts:", signup.canvasUserId, err);
      continue;
    }

    const result = await buildCourseScopedAlerts(client, user, canvasCourseId, config as any).catch((err) => {
      console.error("Error building alerts for", signup.canvasUserId, err);
      return null;
    });
    if (!result) continue;

    for (const alert of result.alerts) {
      // build template vars
      const items = (alert as any).items || [];
      const assignments = items.map((it: any) => it.name || "").filter(Boolean);
      const vars: Record<string, string | number | null | undefined> = {
        name: signup.studentName || user.short_name || user.name || "",
        teacher: "your instructor",
        instructor: "your instructor",
        days: config.missingWorkDays,
        threshold: config.lowGradeThreshold,
        score: (alert as any).score ?? "",
        assignments: formatAssignmentList(assignments),
        hours: config.dueSoonHours,
      };
      try {
        if (alert.kind === "missing" && config.showMissingEmail && config.missingEmailSubject && config.missingEmailBody) {
          const subject = renderAlertTemplate(config.missingEmailSubject, "Missing assignments", vars);
          const body = renderAlertIntro(config.missingEmailBody, DEFAULT_ALERT_MESSAGES.missing, vars);
          await client.sendConversation({ recipients: [userIdNum], subject, body, contextCode: `course_${canvasCourseId}` });
          sent++;
        }
        if (alert.kind === "assignment_low_grade" && config.showAssignmentLowGradesEmail && config.assignmentLowGradeEmailSubject && config.assignmentLowGradeEmailBody) {
          const subject = renderAlertTemplate(config.assignmentLowGradeEmailSubject, "Low assignment grades", vars);
          const body = renderAlertIntro(config.assignmentLowGradeEmailBody, DEFAULT_ALERT_MESSAGES.assignmentLowGrade, vars);
          await client.sendConversation({ recipients: [userIdNum], subject, body, contextCode: `course_${canvasCourseId}` });
          sent++;
        }
        if (alert.kind === "low_grade" && config.showLowGradesEmail && config.lowGradesEmailSubject && config.lowGradesEmailBody) {
          const subject = renderAlertTemplate(config.lowGradesEmailSubject, "Course grade alert", vars);
          const body = renderAlertTemplate(config.lowGradesEmailBody, DEFAULT_ALERT_MESSAGES.overallLowGrade, vars);
          await client.sendConversation({ recipients: [userIdNum], subject, body, contextCode: `course_${canvasCourseId}` });
          sent++;
        }
        if (alert.kind === "login" && config.showLoginInactivityEmail && config.loginInactivityEmailSubject && config.loginInactivityEmailBody) {
          const subject = renderAlertTemplate(config.loginInactivityEmailSubject, "Login reminder", vars);
          const body = renderAlertTemplate(config.loginInactivityEmailBody, DEFAULT_ALERT_MESSAGES.loginInactivity, vars);
          await client.sendConversation({ recipients: [userIdNum], subject, body, contextCode: `course_${canvasCourseId}` });
          sent++;
        }
        if (alert.kind === "due_soon" && config.showDueSoonEmail && config.dueSoonEmailSubject && config.dueSoonEmailBody) {
          const subject = renderAlertTemplate(config.dueSoonEmailSubject, "Assignments due soon", vars);
          const body = renderAlertIntro(config.dueSoonEmailBody, DEFAULT_ALERT_MESSAGES.dueSoon, vars);
          await client.sendConversation({ recipients: [userIdNum], subject, body, contextCode: `course_${canvasCourseId}` });
          sent++;
        }
      } catch (err) {
        console.error("Failed to send conversation to", signup.canvasUserId, err);
      }
    }
  }

  if (sent > 0) {
    try {
      await prisma.courseAlertConfig.update({
        where: { canvasCourseId },
        data: { lastEmailSentAt: new Date() },
      });
    } catch (err) {
      console.error("Failed to update lastEmailSentAt for", canvasCourseId, err);
    }
  }

  return { sent };
}
