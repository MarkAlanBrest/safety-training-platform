export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getCanvasStudentSession } from "@/lib/canvas/session";
import { removeCourseHomeStudentAlerts } from "@/lib/canvas/course-home-embed";

export async function POST(request: Request) {
  const session = getCanvasStudentSession(request);
  if (!session) {
    return NextResponse.json({ error: "Open this setup page from Canvas." }, { status: 401 });
  }

  const body = (await request.json()) as { courseId?: string };
  const courseId = body.courseId?.trim() || session.courseId?.trim() || "";
  if (!courseId) {
    return NextResponse.json({ error: "Course id is required." }, { status: 400 });
  }

  const result = await removeCourseHomeStudentAlerts(courseId);
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
