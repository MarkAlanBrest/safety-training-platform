export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  const url = new URL(request.url);
  const canvasCourseId = url.searchParams.get("courseId")?.trim() || "";
  if (!canvasCourseId) {
    return NextResponse.json({ error: "Course id is required." }, { status: 400 });
  }

  const signups = await prisma.courseAlertSignup.findMany({
    where: { canvasCourseId },
    orderBy: { studentName: "asc" },
  });

  const messages = await prisma.courseAlertMessage.findMany({
    where: { canvasCourseId, active: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ signups, messages });
}
