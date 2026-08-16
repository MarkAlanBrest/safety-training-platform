import { NextResponse } from "next/server";
import { after } from "next/server";
import { getConfiguredLtiClientId, getLtiConfig } from "@/lib/canvas/config";
import { recordCourseAlertSignup } from "@/lib/course-alerts/db";
import {
  canvasSessionCookieOptions,
  encodeCanvasStudentSession,
  CANVAS_SESSION_COOKIE,
} from "@/lib/canvas/session";
import { readDeepLinkingSettings } from "@/lib/lti/deep-linking";
import { isIframeLtiLaunch } from "@/lib/lti/launch-presentation";
import { isInstructorLtiLaunch } from "@/lib/lti/roles";
import { verifyLtiIdToken } from "@/lib/lti/verify";
import { parseLtiState } from "@/lib/lti/state";
import { buildLaunchRedirectHtml, createLaunchHandoff } from "@/lib/lti/launch-handoff";
import { ensureStudentAlertsLtiApp } from "@/lib/canvas/course-home-embed";

let lastPlacementSyncAt = 0;
const PLACEMENT_SYNC_COOLDOWN_MS = 10 * 60 * 1000;

function scheduleStudentAlertsPlacementSync() {
  const now = Date.now();
  if (now - lastPlacementSyncAt < PLACEMENT_SYNC_COOLDOWN_MS) return;
  lastPlacementSyncAt = now;

  const sync = async () => {
    await ensureStudentAlertsLtiApp().catch((error) => {
      console.error("Could not synchronize the Student Alerts Canvas placements:", error);
    });
  };

  try {
    after(sync);
  } catch {
    void sync();
  }
}

function attachSessionCookie(
  response: NextResponse,
  identity: {
    userId: number;
    name: string;
    email: string | null;
    courseId: string | null;
    courseName: string | null;
  },
  isInstructor: boolean,
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
      role: isInstructor ? "instructor" : "student",
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
  isInstructor: boolean,
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
    role: isInstructor ? "instructor" : "student",
  });
  url.searchParams.set("handoff", handoff);

  const response = new NextResponse(buildLaunchRedirectHtml(url.toString()), {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
  return attachSessionCookie(response, identity, isInstructor);
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
  const isHomeEmbedLaunch = (() => {
    try {
      return new URL(parsedState.targetLinkUri || "").searchParams.get("placement") === "home_embed";
    } catch {
      return false;
    }
  })();
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

  if (identity.courseId && !isInstructor) {
    await recordCourseAlertSignup({
      canvasCourseId: identity.courseId,
      canvasUserId: String(identity.userId),
      studentName: identity.name,
      courseName: identity.courseName,
    });
  }

  if (deepLinking) {
    if (!isInstructor) {
      return launchErrorResponse("Only a course instructor can configure Student Alerts.");
    }

    const setupPath = `/canvas/alerts/setup?${
      identity.courseId ? `course=${encodeURIComponent(identity.courseId)}` : ""
    }`;
    return finishLaunch(appOrigin, identity, setupPath, true);
  }

  if (isInstructor && identity.courseId && !isHomeEmbedLaunch) {
    scheduleStudentAlertsPlacementSync();
    return finishLaunch(
      appOrigin,
      identity,
      `/canvas/alerts/setup?course=${encodeURIComponent(identity.courseId)}`,
      true,
    );
  }

  const studentPath = isHomeEmbedLaunch || isIframeLtiLaunch(identity.payload)
    ? "/canvas/home-embed"
    : "/canvas/alerts";

  return finishLaunch(appOrigin, identity, studentPath, false);
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
