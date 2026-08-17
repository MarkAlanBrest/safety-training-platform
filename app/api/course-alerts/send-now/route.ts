export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getCanvasStudentSession } from "@/lib/canvas/session";
import { sendCourseAlertsByCanvas } from "@/lib/course-alerts/send-by-canvas";

export async function POST(request: Request) {
  const session = getCanvasStudentSession(request);
  if (!session) return NextResponse.json({ error: "Open this tool from Canvas." }, { status: 401 });
  if (session.role !== "instructor") return NextResponse.json({ error: "Only instructors can send alerts." }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const courseId = (body?.courseId || body?.canvasCourseId || session.courseId || body?.course)?.toString()?.trim();
  if (!courseId) return NextResponse.json({ error: "courseId is required" }, { status: 400 });
  if (session.courseId && courseId !== session.courseId) return NextResponse.json({ error: "Course mismatch with LTI launch." }, { status: 403 });

  try {
    const res = await sendCourseAlertsByCanvas(courseId);
    return NextResponse.json({ ok: true, result: res });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
