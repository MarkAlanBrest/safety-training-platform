export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { refreshHomeEmbedIfStale } from "@/lib/canvas/course-home-embed";

export async function POST(request: Request) {
  const body = (await request.json()) as { courseId?: string };
  const courseId = body.courseId?.trim();
  if (!courseId) {
    return NextResponse.json({ error: "Course id is required." }, { status: 400 });
  }

  const result = await refreshHomeEmbedIfStale(courseId);
  return NextResponse.json(result);
}
