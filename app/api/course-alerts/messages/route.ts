export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { displayStudentName, normalizeStudentName } from "@/lib/course-alerts";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const canvasCourseId = url.searchParams.get("courseId")?.trim() || "";
  const studentName = displayStudentName(url.searchParams.get("name") || "");

  if (!canvasCourseId || !studentName) {
    return NextResponse.json({ error: "Course and name are required." }, { status: 400 });
  }

  const normalizedName = normalizeStudentName(studentName);
  const now = new Date();

  const [signup, messages] = await Promise.all([
    prisma.courseAlertSignup.findUnique({
      where: {
        canvasCourseId_normalizedName: {
          canvasCourseId,
          normalizedName,
        },
      },
    }),
    prisma.courseAlertMessage.findMany({
      where: {
        canvasCourseId,
        normalizedName,
        active: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return NextResponse.json({
    signedUp: Boolean(signup),
    studentName: signup?.studentName || studentName,
    courseId: canvasCourseId,
    courseName: signup?.courseName || null,
    messages: messages.map((message) => ({
      id: message.id,
      message: message.message,
      createdAt: message.createdAt.toISOString(),
    })),
  });
}
