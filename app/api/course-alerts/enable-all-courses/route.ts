export const runtime = "nodejs";
export const maxDuration = 300;

import { NextResponse } from "next/server";
import { getCanvasStudentSession } from "@/lib/canvas/session";
import { enableStudentAlertsInAllCourses } from "@/lib/canvas/course-home-embed";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const offset = Number(url.searchParams.get("offset") || "0") || 0;
  const generation = Number(url.searchParams.get("generation") || "0") || 0;
  const reset = url.searchParams.get("reset") === "1";
  const result = await enableStudentAlertsInAllCourses({
    offset: reset ? 0 : offset,
    generation: reset ? 0 : generation,
    reset,
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}

export async function POST(request: Request) {
  const session = getCanvasStudentSession(request);
  if (!session) {
    return NextResponse.json({ error: "Open this setup page from Canvas." }, { status: 401 });
  }

  const result = await enableStudentAlertsInAllCourses({ offset: 0, reset: true });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
