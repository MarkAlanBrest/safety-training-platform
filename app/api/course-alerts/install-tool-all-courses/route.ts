export const runtime = "nodejs";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { getCanvasStudentSession } from "@/lib/canvas/session";
import { installStudentAlertsToolSchoolWide } from "@/lib/canvas/course-home-embed";

export async function POST(request: Request) {
  const session = getCanvasStudentSession(request);
  if (!session) {
    return NextResponse.json({ error: "Open this setup page from Canvas." }, { status: 401 });
  }

  const result = await installStudentAlertsToolSchoolWide();
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
