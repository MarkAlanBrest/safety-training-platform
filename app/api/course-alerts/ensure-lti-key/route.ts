export const runtime = "nodejs";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { ensureStudentAlertsLtiApp } from "@/lib/canvas/course-home-embed";

export async function GET() {
  const result = await ensureStudentAlertsLtiApp();
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}

export async function POST() {
  return GET();
}
