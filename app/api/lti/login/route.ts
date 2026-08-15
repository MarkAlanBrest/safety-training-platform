export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { handleLtiLoginPost, handleLtiLoginRequest } from "@/lib/lti/login-handler";
import { handleLtiLaunchPostWithErrorPage } from "@/lib/lti/launch-handler";

function loginErrorResponse(message: string, status = 500) {
  return new NextResponse(
    `<html><body style="font-family:sans-serif;padding:24px;max-width:640px"><h1>Student Alerts could not start</h1><p>${message}</p><p>Open <strong>Student Alerts</strong> from the course menu in Canvas, or just go to the course Home page.</p></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

export async function GET(request: Request) {
  try {
    return handleLtiLoginRequest(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "LTI login failed.";
    return loginErrorResponse(message);
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

    return loginErrorResponse(
      "Canvas did not send a recognizable login or launch request. Reopen Student Alerts from Canvas.",
      400,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "LTI login failed.";
    return loginErrorResponse(message);
  }
}
