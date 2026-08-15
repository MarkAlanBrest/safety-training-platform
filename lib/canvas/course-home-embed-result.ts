import {
  ensureStudentAlertsLtiApp,
  setupCourseHomeStudentAlerts,
} from "@/lib/canvas/course-home-embed";
import { setCourseHomeAlertsEnabled } from "@/lib/course-alerts/store";

export async function embedStudentAlertsOnCourseHome(canvasCourseId: string) {
  try {
    await setCourseHomeAlertsEnabled(canvasCourseId, true);
    const installation = await ensureStudentAlertsLtiApp();
    if (!installation.ok) {
      return {
        ok: false as const,
        reason: installation.note || "Could not prepare the Student Alerts Canvas placement.",
      };
    }
    return await setupCourseHomeStudentAlerts(canvasCourseId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update the course home page.";
    return { ok: false as const, reason: message };
  }
}

