export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getCanvasStudentSession } from "@/lib/canvas/session";
import { embedStudentAlertsOnCourseHome } from "@/lib/canvas/course-home-embed-result";
import {
  decodeDeepLinkSession,
  LTI_DEEP_LINK_COOKIE,
} from "@/lib/lti/deep-link-session";
import { readCookie } from "@/lib/admin-session";
import { saveCourseAlertConfig } from "@/lib/course-alerts/store";

export async function POST(request: Request) {
  const session = getCanvasStudentSession(request);
  if (!session) {
    return NextResponse.json({ error: "Open this setup page from Canvas." }, { status: 401 });
  }

  const deepLinkEncoded = readCookie(request, LTI_DEEP_LINK_COOKIE);
  const deepLink = deepLinkEncoded ? decodeDeepLinkSession(deepLinkEncoded) : null;

  const body = (await request.json()) as {
    courseId?: string;
    courseName?: string | null;
    missingWorkDays?: number;
    lowGradeThreshold?: number;
    bannerMessage?: string | null;
    showMissing?: boolean;
    showLowGrades?: boolean;
  };

  const courseId = body.courseId?.trim() || deepLink?.courseId || session.courseId || "";
  if (!courseId) {
    return NextResponse.json({ error: "Course id is required." }, { status: 400 });
  }

  const config = await saveCourseAlertConfig(
    courseId,
    {
      courseName: body.courseName || deepLink?.courseName || session.courseName,
      missingWorkDays: body.missingWorkDays,
      lowGradeThreshold: body.lowGradeThreshold,
      bannerMessage: body.bannerMessage,
      showMissing: body.showMissing,
      showLowGrades: body.showLowGrades,
    },
    session.name,
  );

  await embedStudentAlertsOnCourseHome(courseId);

  const response = NextResponse.json({
    ok: true,
    config,
    imported: false,
    note: "Settings saved for this course. Students see Alerts on Home — nothing else to insert.",
  });
  if (deepLink) {
    response.cookies.set(LTI_DEEP_LINK_COOKIE, "", { path: "/", maxAge: 0 });
  }
  return response;
}
