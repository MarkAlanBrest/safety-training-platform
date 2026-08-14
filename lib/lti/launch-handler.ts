import { NextResponse } from "next/server";
import { getConfiguredLtiClientId, getLtiConfig } from "@/lib/canvas/config";
import { normalizeStudentName } from "@/lib/course-alerts";
import { parseCourseAlertCustomFields } from "@/lib/course-alerts/config";
import { saveCourseAlertConfig } from "@/lib/course-alerts/store";
import {
  canvasSessionCookieOptions,
  encodeCanvasStudentSession,
  CANVAS_SESSION_COOKIE,
} from "@/lib/canvas/session";
import { readDeepLinkingSettings } from "@/lib/lti/deep-linking";
import {
  decodeDeepLinkSession,
  encodeDeepLinkSession,
  LTI_DEEP_LINK_COOKIE,
} from "@/lib/lti/deep-link-session";
import { isInstructorLtiLaunch } from "@/lib/lti/roles";
import { verifyLtiIdToken } from "@/lib/lti/verify";
import { parseLtiState } from "@/lib/lti/state";
import { prisma } from "@/lib/prisma";

function attachSessionCookie(
  response: NextResponse,
  identity: {
    userId: number;
    name: string;
    email: string | null;
    courseId: string | null;
    courseName: string | null;
  },
) {
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
  response.cookies.set(
    CANVAS_SESSION_COOKIE,
    encodeCanvasStudentSession({
      userId: identity.userId,
      name: identity.name,
      email: identity.email,
      courseId: identity.courseId,
      courseName: identity.courseName,
      source: "lti",
    }),
    {
      ...canvasSessionCookieOptions(expiresAt),
      partitioned: true,
    },
  );
  return response;
}

export async function handleLtiLaunchPost(
  request: Request,
  existingForm?: FormData,
) {
  const form = existingForm ?? (await request.formData());
  const idToken = String(form.get("id_token") || "");
  const state = String(form.get("state") || "");

  if (!idToken || !state) {
    return launchErrorResponse(
      "Missing LTI launch data. Open Student Alerts from Canvas instead of visiting this URL directly.",
    );
  }

  const parsedState = parseLtiState(state);
  const clientId = parsedState.clientId || getConfiguredLtiClientId();
  if (!clientId) {
    return launchErrorResponse(
      "LTI client id was missing from the launch. Reopen Student Alerts from Canvas.",
    );
  }

  const identity = await verifyLtiIdToken(
    idToken,
    parsedState.iss,
    parsedState.nonce,
    clientId,
    request,
  );
  const { appOrigin } = getLtiConfig();
  const deepLinking = readDeepLinkingSettings(identity.payload);
  const isInstructor = isInstructorLtiLaunch(identity.payload);

  const customClaim = identity.payload["https://purl.imsglobal.org/spec/lti/claim/custom"];
  if (identity.courseId && customClaim && typeof customClaim === "object") {
    const raw = customClaim as Record<string, unknown>;
    if (
      raw.missing_work_days !== undefined ||
      raw.low_grade_threshold !== undefined ||
      raw.banner_message !== undefined
    ) {
      await saveCourseAlertConfig(identity.courseId, {
        ...parseCourseAlertCustomFields(raw),
        courseName: identity.courseName,
      });
    }
  }

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
    const setupUrl = new URL(`${appOrigin}/canvas/alerts/setup`);
    if (identity.courseId) setupUrl.searchParams.set("course", identity.courseId);
    setupUrl.searchParams.set("mode", "import");

    const response = NextResponse.redirect(setupUrl.toString(), { status: 303 });
    response.cookies.set(
      LTI_DEEP_LINK_COOKIE,
      encodeDeepLinkSession({
        returnUrl: deepLinking.deep_link_return_url,
        clientId,
        platformIssuer: identity.platformIssuer,
        nonce: identity.nonce,
        courseId: identity.courseId,
        courseName: identity.courseName,
        data: deepLinking.data,
      }),
      {
        path: "/",
        httpOnly: true,
        sameSite: "none",
        secure: true,
        maxAge: 600,
        partitioned: true,
      },
    );
    return attachSessionCookie(response, identity);
  }

  if (isInstructor && identity.courseId) {
    const setupUrl = `${appOrigin}/canvas/alerts/setup?course=${encodeURIComponent(identity.courseId)}`;
    const response = NextResponse.redirect(setupUrl, { status: 303 });
    return attachSessionCookie(response, identity);
  }

  const redirectTarget = identity.courseId
    ? `${appOrigin}/canvas/alerts?course=${encodeURIComponent(identity.courseId)}`
    : `${appOrigin}/canvas/alerts`;

  const response = NextResponse.redirect(redirectTarget, { status: 303 });
  return attachSessionCookie(response, identity);
}

function launchErrorResponse(message: string) {
  return new NextResponse(
    `<html><body style="font-family:sans-serif;padding:24px"><h1>LTI launch failed</h1><p>${message}</p></body></html>`,
    { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

export async function handleLtiLaunchPostWithErrorPage(
  request: Request,
  existingForm?: FormData,
) {
  try {
    return await handleLtiLaunchPost(request, existingForm);
  } catch (error) {
    const message = error instanceof Error ? error.message : "LTI launch failed.";
    return launchErrorResponse(message);
  }
}
