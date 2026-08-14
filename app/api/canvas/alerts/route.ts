export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { buildCanvasAlertSummary } from "@/lib/canvas/alerts";
import { createStudentCanvasClient, getCanvasStudentSession } from "@/lib/canvas/session";

export async function GET(request: Request) {
  const session = getCanvasStudentSession(request);
  if (!session) {
    return NextResponse.json({ error: "Open this tool from Canvas to view your alerts." }, { status: 401 });
  }

  try {
    const client = createStudentCanvasClient(session);
    const user = await client.getUser();
    const summary = await buildCanvasAlertSummary(client, user);
    return NextResponse.json(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load Canvas alerts.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
