export const runtime = "nodejs";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { getCanvasStudentSession } from "@/lib/canvas/session";
import { ensureStudentAlertsLtiApp } from "@/lib/canvas/course-home-embed";

export async function GET() {
  return NextResponse.json({ error: "Method not allowed." }, { status: 405 });
}

export async function POST(request: Request) {
  const session = getCanvasStudentSession(request);
  if (!session) {
    return NextResponse.json({ error: "Open Student Alerts from Canvas." }, { status: 401 });
  }

  const result = await ensureStudentAlertsLtiApp();
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
