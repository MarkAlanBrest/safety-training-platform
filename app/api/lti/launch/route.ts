export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getLtiConfig } from "@/lib/canvas/config";
import {
  canvasSessionCookieOptions,
  encodeCanvasStudentSession,
  CANVAS_SESSION_COOKIE,
} from "@/lib/canvas/session";
import { LTI_NONCE_COOKIE, verifyLtiIdToken } from "@/lib/lti/verify";
import { readCookie } from "@/lib/admin-session";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const idToken = String(form.get("id_token") || "");
    const state = String(form.get("state") || "");

    if (!idToken) {
      return NextResponse.json({ error: "Missing LTI id_token." }, { status: 400 });
    }

    const nonceCookie = readCookie(request, LTI_NONCE_COOKIE);
    if (!nonceCookie) {
      return NextResponse.json({ error: "LTI launch session expired. Reopen the tool from Canvas." }, { status: 400 });
    }

    const parsed = JSON.parse(nonceCookie) as { nonce?: string; state?: string; iss?: string };
    if (!parsed.nonce || !parsed.state || !parsed.iss) {
      return NextResponse.json({ error: "Invalid LTI launch session." }, { status: 400 });
    }

    if (state !== parsed.state) {
      return NextResponse.json({ error: "LTI state did not match." }, { status: 400 });
    }

    const identity = await verifyLtiIdToken(idToken, parsed.iss, parsed.nonce);
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
      canvasSessionCookieOptions(expiresAt),
    );
    response.cookies.set(LTI_NONCE_COOKIE, "", {
      path: "/",
      httpOnly: true,
      sameSite: "none",
      secure: true,
      expires: new Date(0),
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "LTI launch failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
