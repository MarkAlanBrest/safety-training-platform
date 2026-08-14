export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getCanvasStudentSession } from "@/lib/canvas/session";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = getCanvasStudentSession(request);
  if (!session) {
    return NextResponse.json({ error: "Open this tool from Canvas." }, { status: 401 });
  }

  const url = new URL(request.url);
  const canvasCourseId =
    url.searchParams.get("courseId")?.trim() ||
    url.searchParams.get("course")?.trim() ||
    session.courseId?.trim() ||
    "";
  if (!canvasCourseId) {
    return NextResponse.json({ error: "Course id is required." }, { status: 400 });
  }

  const canvasUserId = String(session.userId);
  const now = new Date();

  const [signup, messages] = await Promise.all([
    prisma.courseAlertSignup.findUnique({
      where: {
        canvasCourseId_canvasUserId: {
          canvasCourseId,
          canvasUserId,
        },
      },
    }),
    prisma.courseAlertMessage.findMany({
      where: {
        canvasCourseId,
        canvasUserId,
        active: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return NextResponse.json({
    signedUp: Boolean(signup),
    studentName: signup?.studentName || session.name,
    courseId: canvasCourseId,
    courseName: signup?.courseName || null,
    canvasUserId,
    messages: messages.map((message) => ({
      id: message.id,
      message: message.message,
      createdAt: message.createdAt.toISOString(),
    })),
  });
}
