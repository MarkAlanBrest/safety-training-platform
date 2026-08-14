export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getLtiConfig } from "@/lib/canvas/config";
import { handleLtiLoginRequest } from "@/lib/lti/login-handler";
import { handleLtiLaunchPostWithErrorPage } from "@/lib/lti/launch-handler";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const hasOidcParams =
      url.searchParams.has("iss") &&
      url.searchParams.has("login_hint") &&
      url.searchParams.has("target_link_uri");

    if (hasOidcParams) {
      return handleLtiLoginRequest(request);
    }

    const { appOrigin } = getLtiConfig();
    return NextResponse.redirect(`${appOrigin}/canvas/alerts`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "LTI launch failed.";
    return new NextResponse(
      `<html><body style="font-family:sans-serif;padding:24px"><h1>LTI launch failed</h1><p>${message}</p></body></html>`,
      { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }
}

export async function POST(request: Request) {
  return handleLtiLaunchPostWithErrorPage(request);
}
