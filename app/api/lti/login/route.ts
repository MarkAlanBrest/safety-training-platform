export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { handleLtiLoginRequest } from "@/lib/lti/login-handler";
import { handleLtiLaunchPostWithErrorPage } from "@/lib/lti/launch-handler";

export async function GET(request: Request) {
  try {
    return handleLtiLoginRequest(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "LTI login failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return handleLtiLaunchPostWithErrorPage(request);
}
