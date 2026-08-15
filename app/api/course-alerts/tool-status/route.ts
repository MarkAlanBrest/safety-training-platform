export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getCanvasStudentSession } from "@/lib/canvas/session";
import { diagnoseStudentAlertsTool } from "@/lib/canvas/course-home-embed";

export async function GET(request: Request) {
  const session = getCanvasStudentSession(request);
  if (!session) {
    return NextResponse.json({ error: "Open this setup page from Canvas." }, { status: 401 });
  }

  const url = new URL(request.url);
  const courseId = url.searchParams.get("courseId")?.trim() || session.courseId?.trim() || "";
  if (!courseId) {
    return NextResponse.json({ error: "Course id is required." }, { status: 400 });
  }

  try {
    const status = await diagnoseStudentAlertsTool(courseId);
    return NextResponse.json(status);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Could not check Canvas tool status.",
      },
      { status: 500 },
    );
  }
}
