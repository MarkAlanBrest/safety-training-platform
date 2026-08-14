export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { buildCanvasAlertSummary } from "@/lib/canvas/alerts";
import { createCanvasClient } from "@/lib/canvas/client";
import { getCanvasSession } from "@/lib/canvas/session";

export async function GET(request: Request) {
  const session = getCanvasSession(request);
  if (!session) {
    return NextResponse.json({ error: "Not connected to Canvas." }, { status: 401 });
  }

  try {
    const client = createCanvasClient(session);
    const user = await client.getCurrentUser();
    const summary = await buildCanvasAlertSummary(client, user);
    return NextResponse.json(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load Canvas alerts.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
