import { normalizeStudentName } from "@/lib/course-alerts";
import { prisma } from "@/lib/prisma";

export async function recordCourseAlertSignup(params: {
  canvasCourseId: string;
  canvasUserId: string;
  studentName: string;
  courseName: string | null;
}) {
  try {
    await prisma.courseAlertSignup.upsert({
      where: {
        canvasCourseId_canvasUserId: {
          canvasCourseId: params.canvasCourseId,
          canvasUserId: params.canvasUserId,
        },
      },
      create: {
        canvasCourseId: params.canvasCourseId,
        canvasUserId: params.canvasUserId,
        studentName: params.studentName,
        normalizedName: normalizeStudentName(params.studentName),
        courseName: params.courseName,
      },
      update: {
        studentName: params.studentName,
        normalizedName: normalizeStudentName(params.studentName),
        courseName: params.courseName,
      },
    });
  } catch (error) {
    console.error("Course alert signup failed:", error);
  }
}

export function isMissingCourseAlertTableError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("CourseAlertSignup") || message.includes("CourseAlertConfig");
}
