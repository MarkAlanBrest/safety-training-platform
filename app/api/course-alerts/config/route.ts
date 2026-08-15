export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAdminSession, requireAdmin } from "@/lib/admin-session";
import { getCanvasStudentSession } from "@/lib/canvas/session";
import { embedStudentAlertsOnCourseHome } from "@/lib/canvas/course-home-embed-result";
import { getCourseAlertConfig, saveCourseAlertConfig } from "@/lib/course-alerts/store";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const courseId = url.searchParams.get("courseId")?.trim() || url.searchParams.get("course")?.trim();
  if (!courseId) {
    return NextResponse.json({ error: "Course id is required." }, { status: 400 });
  }

  const config = await getCourseAlertConfig(courseId);
  return NextResponse.json({ config });
}

export async function PUT(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  const admin = await getAdminSession(request);

  const body = (await request.json()) as {
    courseId?: string;
    courseName?: string | null;
    missingWorkDays?: number;
    lowGradeThreshold?: number;
    bannerMessage?: string | null;
    showMissing?: boolean;
    showLowGrades?: boolean;
  };

  const courseId = body.courseId?.trim();
  if (!courseId) {
    return NextResponse.json({ error: "Course id is required." }, { status: 400 });
  }

  const config = await saveCourseAlertConfig(
    courseId,
    {
      courseName: body.courseName,
      missingWorkDays: body.missingWorkDays,
      lowGradeThreshold: body.lowGradeThreshold,
      bannerMessage: body.bannerMessage,
      showMissing: body.showMissing,
      showLowGrades: body.showLowGrades,
    },
    admin?.admin?.email || admin?.admin?.name || "teacher",
  );

  const homeEmbed = await embedStudentAlertsOnCourseHome(courseId);

  return NextResponse.json({ config, homeEmbed });
}

export async function POST(request: Request) {
  const session = getCanvasStudentSession(request);
  if (!session) {
    return NextResponse.json({ error: "Open this setup page from Canvas." }, { status: 401 });
  }

  const body = (await request.json()) as {
    courseId?: string;
    courseName?: string | null;
    missingWorkDays?: number;
    lowGradeThreshold?: number;
    bannerMessage?: string | null;
    showMissing?: boolean;
    showLowGrades?: boolean;
  };

  const courseId = body.courseId?.trim() || session.courseId?.trim() || "";
  if (!courseId) {
    return NextResponse.json({ error: "Course id is required." }, { status: 400 });
  }

  const config = await saveCourseAlertConfig(
    courseId,
    {
      courseName: body.courseName || session.courseName,
      missingWorkDays: body.missingWorkDays,
      lowGradeThreshold: body.lowGradeThreshold,
      bannerMessage: body.bannerMessage,
      showMissing: body.showMissing,
      showLowGrades: body.showLowGrades,
    },
    session.name,
  );

  const homeEmbed = await embedStudentAlertsOnCourseHome(courseId);

  return NextResponse.json({ config, homeEmbed });
}
