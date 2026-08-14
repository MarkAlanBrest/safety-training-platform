export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { handleLtiLoginPost, handleLtiLoginRequest } from "@/lib/lti/login-handler";
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
  try {
    const result = await handleLtiLoginPost(request);

    if (result.kind === "login") {
      return result.response;
    }

    if (result.kind === "launch") {
      return handleLtiLaunchPostWithErrorPage(request, result.form);
    }

    return NextResponse.json(
      {
        error:
          "Unrecognized LTI request. Open Student Alerts from Canvas (Modules → External Tool), not this URL directly.",
      },
      { status: 400 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "LTI login failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
