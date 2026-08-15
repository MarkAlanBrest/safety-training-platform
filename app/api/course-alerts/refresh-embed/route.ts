export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { refreshHomeEmbedIfStale } from "@/lib/canvas/course-home-embed";
import { getCanvasStudentSession } from "@/lib/canvas/session";

export async function POST(request: Request) {
  const session = getCanvasStudentSession(request);
  if (!session || session.role !== "instructor") {
    return NextResponse.json({ error: "Open the teacher setup page from Canvas." }, { status: 401 });
  }
  const body = (await request.json()) as { courseId?: string };
  const courseId = body.courseId?.trim();
  if (!courseId) {
    return NextResponse.json({ error: "Course id is required." }, { status: 400 });
  }
  if (session.courseId && courseId !== session.courseId) {
    return NextResponse.json({ error: "The course did not match this Canvas launch." }, { status: 403 });
  }

  const result = await refreshHomeEmbedIfStale(courseId);
  return NextResponse.json(result);
}
