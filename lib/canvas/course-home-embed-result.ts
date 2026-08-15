import { setupCourseHomeStudentAlerts } from "@/lib/canvas/course-home-embed";
import { getCourseAlertConfig } from "@/lib/course-alerts/store";

export async function embedStudentAlertsOnCourseHome(canvasCourseId: string) {
  try {
    const config = await getCourseAlertConfig(canvasCourseId);
    return await setupCourseHomeStudentAlerts(canvasCourseId, {
      bannerMessage: config.bannerMessage,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update course home page.";
    return { ok: false as const, reason: message };
  }
}
