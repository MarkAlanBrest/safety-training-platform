export const runtime = "nodejs";

import { getCanvasStudentSession } from "@/lib/canvas/session";
import { getStudentDisplayName } from "@/lib/canvas/home-embed-messages";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const courseId = url.searchParams.get("course")?.trim() || url.searchParams.get("courseId")?.trim() || "";
  const session = getCanvasStudentSession(request);

  if (session?.name) {
    return Response.json({
      studentName: getStudentDisplayName(session.name),
      source: "session",
    });
  }

  if (session?.userId && courseId) {
    const signup = await prisma.courseAlertSignup.findUnique({
      where: {
        canvasCourseId_canvasUserId: {
          canvasCourseId: courseId,
          canvasUserId: String(session.userId),
        },
      },
    });
    if (signup?.studentName) {
      return Response.json({
        studentName: getStudentDisplayName(signup.studentName),
        source: "signup",
      });
    }
  }

  return Response.json({
    studentName: "Student",
    source: "default",
  });
}
