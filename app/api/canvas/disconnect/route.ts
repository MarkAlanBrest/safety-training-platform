export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { CANVAS_SESSION_COOKIE } from "@/lib/canvas/session";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(CANVAS_SESSION_COOKIE, "", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(0),
  });
  return response;
}
