export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getCanvasStudentSession } from "@/lib/canvas/session";

export async function GET(request: Request) {
  const session = getCanvasStudentSession(request);
  if (!session) {
    return NextResponse.json({ connected: false });
  }

  return NextResponse.json({
    connected: true,
    user: {
      id: session.userId,
      name: session.name,
      shortName: session.name.split(" ")[0] || session.name,
    },
    courseId: session.courseId,
    courseName: session.courseName,
    isInstructor: session.isInstructor,
    source: session.source,
    connectedAt: session.connectedAt,
    expiresAt: session.expiresAt,
  });
}
