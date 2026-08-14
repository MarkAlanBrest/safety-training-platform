export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getLtiConfig } from "@/lib/canvas/config";
import { normalizeStudentName } from "@/lib/course-alerts";
import {
  canvasSessionCookieOptions,
  encodeCanvasStudentSession,
  CANVAS_SESSION_COOKIE,
} from "@/lib/canvas/session";
import {
  buildDeepLinkingHtml,
  buildDeepLinkingResponse,
  readDeepLinkingSettings,
} from "@/lib/lti/deep-linking";
import { verifyLtiIdToken } from "@/lib/lti/verify";
import { parseLtiState } from "@/lib/lti/state";
import { prisma } from "@/lib/prisma";

function attachSessionCookie(
  response: NextResponse,
  identity: { userId: number; name: string; email: string | null },
) {
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
  response.cookies.set(
    CANVAS_SESSION_COOKIE,
    encodeCanvasStudentSession({
      userId: identity.userId,
      name: identity.name,
      email: identity.email,
      source: "lti",
    }),
    {
      ...canvasSessionCookieOptions(expiresAt),
      partitioned: true,
    },
  );
  return response;
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const idToken = String(form.get("id_token") || "");
    const state = String(form.get("state") || "");

    if (!idToken || !state) {
      return NextResponse.json({ error: "Missing LTI launch data." }, { status: 400 });
    }

    const parsedState = parseLtiState(state);
    const identity = await verifyLtiIdToken(idToken, parsedState.iss, parsedState.nonce);
    const { clientId, appOrigin, launchUrl } = getLtiConfig();
    const deepLinking = readDeepLinkingSettings(identity.payload);

    if (identity.courseId) {
      await prisma.courseAlertSignup.upsert({
        where: {
          canvasCourseId_canvasUserId: {
            canvasCourseId: identity.courseId,
            canvasUserId: String(identity.userId),
          },
        },
        create: {
          canvasCourseId: identity.courseId,
          canvasUserId: String(identity.userId),
          studentName: identity.name,
          normalizedName: normalizeStudentName(identity.name),
          courseName: identity.courseName,
        },
        update: {
          studentName: identity.name,
          normalizedName: normalizeStudentName(identity.name),
          courseName: identity.courseName,
        },
      });
    }

    if (deepLinking) {
      const jwt = await buildDeepLinkingResponse({
        clientId,
        platformIssuer: identity.platformIssuer,
        nonce: identity.nonce,
        launchUrl,
        data: deepLinking.data,
      });
      const response = new NextResponse(buildDeepLinkingHtml(deepLinking.deep_link_return_url, jwt), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
      return attachSessionCookie(response, identity);
    }

    const redirectTarget = identity.courseId
      ? `${appOrigin}/canvas/alerts?course=${encodeURIComponent(identity.courseId)}`
      : `${appOrigin}/canvas/alerts`;

    const response = NextResponse.redirect(redirectTarget, { status: 303 });
    return attachSessionCookie(response, identity);
  } catch (error) {
    const message = error instanceof Error ? error.message : "LTI launch failed.";
    return new NextResponse(
      `<html><body style="font-family:sans-serif;padding:24px"><h1>LTI launch failed</h1><p>${message}</p></body></html>`,
      { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }
}
