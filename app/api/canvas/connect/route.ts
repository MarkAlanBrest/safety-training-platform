export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { validateCanvasConfig } from "@/lib/canvas/client";
import {
  CANVAS_SESSION_COOKIE,
  canvasSessionCookieOptions,
  encodeCanvasSession,
} from "@/lib/canvas/session";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const baseUrl = String(body.baseUrl || "").trim();
    const token = String(body.token || "").trim();

    if (!baseUrl || !token) {
      return NextResponse.json(
        { error: "Canvas URL and access token are required." },
        { status: 400 },
      );
    }

    const { user } = await validateCanvasConfig({ baseUrl, token });
    const encoded = encodeCanvasSession({ baseUrl, token });
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const response = NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        name: user.name,
        shortName: user.short_name,
      },
    });
    response.cookies.set(CANVAS_SESSION_COOKIE, encoded, canvasSessionCookieOptions(expiresAt));
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not connect to Canvas.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
