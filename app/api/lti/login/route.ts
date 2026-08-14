export const runtime = "nodejs";

import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getLtiConfig } from "@/lib/canvas/config";
import { buildAuthorizeRedirectUrl } from "@/lib/lti/verify";
import { LTI_NONCE_COOKIE } from "@/lib/lti/verify";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const iss = url.searchParams.get("iss");
    const loginHint = url.searchParams.get("login_hint");
    const targetLinkUri = url.searchParams.get("target_link_uri");
    const ltiMessageHint = url.searchParams.get("lti_message_hint");
    const clientId = url.searchParams.get("client_id");

    if (!iss || !loginHint || !targetLinkUri || !ltiMessageHint || !clientId) {
      return NextResponse.json({ error: "Missing required LTI login parameters." }, { status: 400 });
    }

    const { clientId: expectedClientId } = getLtiConfig();
    if (clientId !== expectedClientId) {
      return NextResponse.json({ error: "Unexpected LTI client id." }, { status: 400 });
    }

    const state = randomBytes(16).toString("hex");
    const nonce = randomBytes(16).toString("hex");

    const redirectUrl = buildAuthorizeRedirectUrl({
      issuer: iss,
      clientId,
      loginHint,
      ltiMessageHint,
      targetLinkUri,
      state,
      nonce,
    });

    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set(
      LTI_NONCE_COOKIE,
      JSON.stringify({ nonce, state, iss }),
      {
        path: "/",
        httpOnly: true,
        sameSite: "none",
        secure: true,
        maxAge: 300,
      },
    );
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "LTI login failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
