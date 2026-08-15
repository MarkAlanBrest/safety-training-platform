export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { readCookie } from "@/lib/admin-session";
import { getLtiConfig } from "@/lib/canvas/config";
import { embedStudentAlertsOnCourseHome } from "@/lib/canvas/course-home-embed-result";
import { getCanvasStudentSession } from "@/lib/canvas/session";
import { saveCourseAlertConfig } from "@/lib/course-alerts/store";
import { buildDeepLinkingHtml, buildDeepLinkingResponse } from "@/lib/lti/deep-linking";
import { decodeDeepLinkSession, LTI_DEEP_LINK_COOKIE } from "@/lib/lti/deep-link-session";

type FinishBody = {
  courseId?: string;
  courseName?: string | null;
  missingWorkDays?: number;
  lowGradeThreshold?: number;
  assignmentLowGradePercent?: number;
  loginInactivityDays?: number;
  dueSoonHours?: number;
  bannerMessage?: string | null;
  missingMessage?: string | null;
  assignmentLowGradeMessage?: string | null;
  loginInactivityMessage?: string | null;
  overallLowGradeMessage?: string | null;
  dueSoonMessage?: string | null;
  showMissing?: boolean;
  showLowGrades?: boolean;
  showAssignmentLowGrades?: boolean;
  showLoginInactivity?: boolean;
  showDueSoon?: boolean;
};

export async function POST(request: Request) {
  const session = getCanvasStudentSession(request);
  if (!session) {
    return NextResponse.json({ error: "Open this setup page from Canvas." }, { status: 401 });
  }
  if (session.role !== "instructor") {
    return NextResponse.json({ error: "Only a course instructor can configure Student Alerts." }, { status: 403 });
  }

  const encoded = readCookie(request, LTI_DEEP_LINK_COOKIE);
  const deepLink = encoded ? decodeDeepLinkSession(encoded) : null;
  if (!deepLink) {
    return NextResponse.json(
      { error: "This Canvas add-item session expired. Close the window and choose Student Alerts again." },
      { status: 409 },
    );
  }

  const body = (await request.json()) as FinishBody;
  const courseId = body.courseId?.trim() || deepLink.courseId || session.courseId || "";
  if (!courseId) {
    return NextResponse.json({ error: "Course id is required." }, { status: 400 });
  }
  if (deepLink.courseId && courseId !== deepLink.courseId) {
    return NextResponse.json({ error: "The course did not match this Canvas launch." }, { status: 403 });
  }
  if (session.courseId && courseId !== session.courseId) {
    return NextResponse.json({ error: "The course did not match the instructor session." }, { status: 403 });
  }

  await saveCourseAlertConfig(
    courseId,
    {
      courseName: body.courseName || deepLink.courseName || session.courseName,
      missingWorkDays: body.missingWorkDays,
      lowGradeThreshold: body.lowGradeThreshold,
      assignmentLowGradePercent: body.assignmentLowGradePercent,
      loginInactivityDays: body.loginInactivityDays,
      dueSoonHours: body.dueSoonHours,
      bannerMessage: body.bannerMessage,
      missingMessage: body.missingMessage,
      assignmentLowGradeMessage: body.assignmentLowGradeMessage,
      loginInactivityMessage: body.loginInactivityMessage,
      overallLowGradeMessage: body.overallLowGradeMessage,
      dueSoonMessage: body.dueSoonMessage,
      showMissing: body.showMissing,
      showLowGrades: body.showLowGrades,
      showAssignmentLowGrades: body.showAssignmentLowGrades,
      showLoginInactivity: body.showLoginInactivity,
      showDueSoon: body.showDueSoon,
      homeEmbedEnabled: true,
    },
    session.name,
  );

  const homeEmbed = await embedStudentAlertsOnCourseHome(courseId);
  if (!homeEmbed.ok) {
    return NextResponse.json(
      { error: `Settings were saved, but Canvas Home could not be updated: ${homeEmbed.reason}` },
      { status: 502 },
    );
  }

  const { launchUrl } = getLtiConfig();
  const jwt = await buildDeepLinkingResponse({
    clientId: deepLink.clientId,
    platformIssuer: deepLink.platformIssuer,
    deploymentId: deepLink.deploymentId,
    nonce: deepLink.nonce,
    launchUrl,
    data: deepLink.data,
  });
  const response = new NextResponse(buildDeepLinkingHtml(deepLink.returnUrl, jwt), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
  response.cookies.set(LTI_DEEP_LINK_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
