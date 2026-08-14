export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createCanvasClient } from "@/lib/canvas/client";
import { getCanvasSession } from "@/lib/canvas/session";

export async function GET(request: Request) {
  const session = getCanvasSession(request);
  if (!session) {
    return NextResponse.json({ connected: false });
  }

  try {
    const client = createCanvasClient(session);
    const user = await client.getCurrentUser();
    return NextResponse.json({
      connected: true,
      user: {
        id: user.id,
        name: user.name,
        shortName: user.short_name,
      },
      connectedAt: session.connectedAt,
      expiresAt: session.expiresAt,
      canvasBaseUrl: client.baseUrl,
    });
  } catch {
    return NextResponse.json({ connected: false, stale: true });
  }
}
