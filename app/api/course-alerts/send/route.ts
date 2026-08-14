export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAdminSession, requireAdmin } from "@/lib/admin-session";
import { normalizeStudentName } from "@/lib/course-alerts";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json();
    const canvasCourseId = String(body.courseId || "").trim();
    const canvasUserId = String(body.canvasUserId || "").trim();
    const message = String(body.message || "").trim();
    const courseName = String(body.courseName || "").trim() || null;

    if (!canvasCourseId || !canvasUserId || !message) {
      return NextResponse.json(
        { error: "Course, student, and message are required." },
        { status: 400 },
      );
    }

    const signup = await prisma.courseAlertSignup.findUnique({
      where: {
        canvasCourseId_canvasUserId: {
          canvasCourseId,
          canvasUserId,
        },
      },
    });

    if (!signup) {
      return NextResponse.json(
        { error: "That student has not opened alerts in this course yet." },
        { status: 400 },
      );
    }

    const session = await getAdminSession(request);
    const created = await prisma.courseAlertMessage.create({
      data: {
        canvasCourseId,
        canvasUserId,
        studentName: signup.studentName,
        message,
        createdBy: session?.admin?.email || session?.admin?.name || "teacher",
      },
    });

    if (courseName) {
      await prisma.courseAlertSignup.update({
        where: { id: signup.id },
        data: { courseName },
      });
    }

    return NextResponse.json({
      ok: true,
      message: {
        id: created.id,
        studentName: created.studentName,
        message: created.message,
        createdAt: created.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Course alert send failed:", error);
    return NextResponse.json({ error: "Could not send alert." }, { status: 500 });
  }
}
