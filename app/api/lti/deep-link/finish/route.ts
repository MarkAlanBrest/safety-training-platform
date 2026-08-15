export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getLtiConfig } from "@/lib/canvas/config";
import { getCanvasStudentSession } from "@/lib/canvas/session";
import { buildDeepLinkingHtml, buildDeepLinkingResponse } from "@/lib/lti/deep-linking";
import {
  decodeDeepLinkSession,
  LTI_DEEP_LINK_COOKIE,
} from "@/lib/lti/deep-link-session";
import { readCookie } from "@/lib/admin-session";
import { embedStudentAlertsOnCourseHome } from "@/lib/canvas/course-home-embed-result";
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

  const homeEmbed = await embedStudentAlertsOnCourseHome(courseId);

  if (!deepLink) {
    return NextResponse.json({ ok: true, config, imported: false, homeEmbed });
  }

  try {
    const { launchUrl } = getLtiConfig();
    const jwt = await buildDeepLinkingResponse({
      clientId: deepLink.clientId,
      platformIssuer: deepLink.platformIssuer,
      deploymentId: deepLink.deploymentId,
      nonce: deepLink.nonce,
      launchUrl,
      data: deepLink.data,
      config,
    });

    const response = new NextResponse(
      buildDeepLinkingHtml(deepLink.returnUrl, jwt),
      { headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
    response.cookies.set(LTI_DEEP_LINK_COOKIE, "", { path: "/", maxAge: 0 });
    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not finish Canvas import.";
    return NextResponse.json(
      {
        ok: true,
        config,
        imported: false,
        warning:
          message.includes("CANVAS_LTI_PRIVATE_KEY_JWK")
            ? "Settings saved. Automatic Canvas import is not configured yet — add the tool manually (see steps below)."
            : message,
        manualImport: message.includes("CANVAS_LTI_PRIVATE_KEY_JWK"),
      },
      { status: 200 },
    );
  }
}
