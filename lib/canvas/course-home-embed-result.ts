import { setupCourseHomeStudentAlerts } from "@/lib/canvas/course-home-embed";

export async function embedStudentAlertsOnCourseHome(canvasCourseId: string) {
  try {
    return await setupCourseHomeStudentAlerts(canvasCourseId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update the course home page.";
    return { ok: false as const, reason: message };
  }
}
