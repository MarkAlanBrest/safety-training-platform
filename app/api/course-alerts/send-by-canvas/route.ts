export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-session";
import { sendCourseAlertsByCanvas } from "@/lib/course-alerts/send-by-canvas";

export async function POST(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => ({}));
  const courseId = (body?.courseId || body?.canvasCourseId || body?.course)?.toString()?.trim();
  if (!courseId) return NextResponse.json({ error: "courseId is required" }, { status: 400 });

  try {
    const result = await sendCourseAlertsByCanvas(courseId);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
