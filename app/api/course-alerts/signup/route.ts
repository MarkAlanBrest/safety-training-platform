export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { displayStudentName, normalizeStudentName } from "@/lib/course-alerts";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const canvasCourseId = String(body.courseId || "").trim();
    const studentName = displayStudentName(String(body.studentName || ""));
    const courseName = String(body.courseName || "").trim() || null;

    if (!canvasCourseId || !studentName) {
      return NextResponse.json({ error: "Course and name are required." }, { status: 400 });
    }

    const normalizedName = normalizeStudentName(studentName);
    const signup = await prisma.courseAlertSignup.upsert({
      where: {
        canvasCourseId_normalizedName: {
          canvasCourseId,
          normalizedName,
        },
      },
      create: {
        canvasCourseId,
        courseName,
        studentName,
        normalizedName,
      },
      update: {
        studentName,
        courseName,
      },
    });

    return NextResponse.json({
      ok: true,
      signup: {
        id: signup.id,
        studentName: signup.studentName,
        courseId: signup.canvasCourseId,
        courseName: signup.courseName,
      },
    });
  } catch (error) {
    console.error("Course alert signup failed:", error);
    return NextResponse.json({ error: "Could not save signup." }, { status: 500 });
  }
}
