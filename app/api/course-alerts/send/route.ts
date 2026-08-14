export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAdminSession, requireAdmin } from "@/lib/admin-session";
import { displayStudentName, normalizeStudentName } from "@/lib/course-alerts";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json();
    const canvasCourseId = String(body.courseId || "").trim();
    const studentName = displayStudentName(String(body.studentName || ""));
    const message = String(body.message || "").trim();
    const courseName = String(body.courseName || "").trim() || null;

    if (!canvasCourseId || !studentName || !message) {
      return NextResponse.json(
        { error: "Course, student name, and message are required." },
        { status: 400 },
      );
    }

    const normalizedName = normalizeStudentName(studentName);
    const signup = await prisma.courseAlertSignup.findUnique({
      where: {
        canvasCourseId_normalizedName: {
          canvasCourseId,
          normalizedName,
        },
      },
    });

    if (!signup) {
      return NextResponse.json(
        { error: "That student has not signed up for alerts in this course yet." },
        { status: 400 },
      );
    }

    const session = await getAdminSession(request);
    const created = await prisma.courseAlertMessage.create({
      data: {
        canvasCourseId,
        studentName: signup.studentName,
        normalizedName,
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
