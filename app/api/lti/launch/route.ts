export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getLtiConfig } from "@/lib/canvas/config";
import {
  canvasSessionCookieOptions,
  encodeCanvasStudentSession,
  CANVAS_SESSION_COOKIE,
} from "@/lib/canvas/session";
import { verifyLtiIdToken } from "@/lib/lti/verify";
import { parseLtiState } from "@/lib/lti/state";

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
    const { targetUrl } = getLtiConfig();
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);

    const response = NextResponse.redirect(targetUrl, { status: 303 });
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
  } catch (error) {
    const message = error instanceof Error ? error.message : "LTI launch failed.";
    return new NextResponse(
      `<html><body style="font-family:sans-serif;padding:24px"><h1>LTI launch failed</h1><p>${message}</p></body></html>`,
      { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }
}
