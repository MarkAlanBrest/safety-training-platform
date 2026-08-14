export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { buildCourseScopedAlerts } from "@/lib/canvas/course-alerts-feed";
import { createStudentCanvasClient, getCanvasStudentSession } from "@/lib/canvas/session";
import { getCourseAlertConfig } from "@/lib/course-alerts/store";
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

  const config = await getCourseAlertConfig(canvasCourseId);
  const canvasUserId = String(session.userId);
  const now = new Date();

  const [summary, signup, messages] = await Promise.all([
    (async () => {
      try {
        const client = createStudentCanvasClient(session);
        const user = await client.getUser();
        return await buildCourseScopedAlerts(client, user, canvasCourseId, config);
      } catch {
        return { user: null, alerts: [], fetchedAt: new Date().toISOString() };
      }
    })(),
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
    courseId: canvasCourseId,
    courseName: signup?.courseName || config.courseName || session.courseName,
    studentName: signup?.studentName || session.name,
    config,
    bannerMessage: config.bannerMessage,
    alerts: summary.alerts,
    teacherMessages: messages.map((message) => ({
      id: message.id,
      message: message.message,
      createdAt: message.createdAt.toISOString(),
    })),
    fetchedAt: summary.fetchedAt,
  });
}
