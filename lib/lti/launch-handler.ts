import { NextResponse } from "next/server";
import { getConfiguredLtiClientId, getLtiConfig } from "@/lib/canvas/config";
import { parseCourseAlertCustomFields } from "@/lib/course-alerts/config";
import { recordCourseAlertSignup } from "@/lib/course-alerts/db";
import { saveCourseAlertConfig } from "@/lib/course-alerts/store";
import {
  canvasSessionCookieOptions,
  encodeCanvasStudentSession,
  CANVAS_SESSION_COOKIE,
} from "@/lib/canvas/session";
import { readDeepLinkingSettings } from "@/lib/lti/deep-linking";
import { isInstructorLtiLaunch } from "@/lib/lti/roles";
import { verifyLtiIdToken } from "@/lib/lti/verify";
import { parseLtiState } from "@/lib/lti/state";
import { buildLaunchRedirectHtml, createLaunchHandoff } from "@/lib/lti/launch-handoff";

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

function finishLaunch(
  appOrigin: string,
  identity: {
    userId: number;
    name: string;
    email: string | null;
    courseId: string | null;
    courseName: string | null;
  },
  path: string,
) {
  const url = new URL(path.startsWith("http") ? path : `${appOrigin}${path}`);
  if (identity.courseId && !url.searchParams.has("course")) {
    url.searchParams.set("course", identity.courseId);
  }

  const handoff = createLaunchHandoff({
    userId: identity.userId,
    name: identity.name,
    email: identity.email,
    courseId: identity.courseId,
    courseName: identity.courseName,
  });
  url.searchParams.set("handoff", handoff);

  const response = new NextResponse(buildLaunchRedirectHtml(url.toString()), {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
  return attachSessionCookie(response, identity);
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
      try {
        await saveCourseAlertConfig(identity.courseId, {
          ...parseCourseAlertCustomFields(raw),
          courseName: identity.courseName,
        });
      } catch (error) {
        console.error("Course alert config save failed:", error);
      }
    }
  }

  if (identity.courseId) {
    await recordCourseAlertSignup({
      canvasCourseId: identity.courseId,
      canvasUserId: String(identity.userId),
      studentName: identity.name,
      courseName: identity.courseName,
    });
  }

  if (deepLinking) {
    const setupPath = `/canvas/alerts/setup${identity.courseId ? `?course=${encodeURIComponent(identity.courseId)}` : ""}`;
    return finishLaunch(appOrigin, identity, setupPath);
  }

  if (isInstructor && identity.courseId) {
    return finishLaunch(
      appOrigin,
      identity,
      `/canvas/alerts/setup?course=${encodeURIComponent(identity.courseId)}`,
    );
  }

  return finishLaunch(appOrigin, identity, "/canvas/alerts");
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
