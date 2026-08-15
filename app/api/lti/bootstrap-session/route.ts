export const runtime = "nodejs";

import { NextResponse } from "next/server";
import {
  CANVAS_SESSION_COOKIE,
  canvasSessionCookieOptions,
  encodeCanvasStudentSession,
} from "@/lib/canvas/session";
import { parseLaunchHandoff } from "@/lib/lti/launch-handoff";

export async function POST(request: Request) {
  const body = (await request.json()) as { handoff?: string };
  const handoff = body.handoff?.trim();
  if (!handoff) {
    return NextResponse.json({ error: "Handoff token is required." }, { status: 400 });
  }

  const parsed = parseLaunchHandoff(handoff);
  if (!parsed) {
    return NextResponse.json({ error: "Handoff token is invalid or expired." }, { status: 401 });
  }

  const expiresAt = new Date(parsed.exp);
  const response = NextResponse.json({
    connected: true,
    userId: parsed.userId,
    courseId: parsed.courseId,
    isInstructor: parsed.isInstructor ?? false,
  });
  response.cookies.set(
    CANVAS_SESSION_COOKIE,
    encodeCanvasStudentSession({
      userId: parsed.userId,
      name: parsed.name,
      email: parsed.email,
      courseId: parsed.courseId,
      courseName: parsed.courseName,
      isInstructor: parsed.isInstructor ?? false,
      source: "lti",
    }),
    {
      ...canvasSessionCookieOptions(expiresAt),
      partitioned: true,
    },
  );
  return response;
}
