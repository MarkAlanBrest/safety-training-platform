export const runtime = "nodejs";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { getCanvasServerConfigStatus } from "@/lib/canvas/config";
import { createCanvasAdminClient } from "@/lib/canvas/admin-client";

export async function GET() {
  const status = getCanvasServerConfigStatus();
  if (!status.ready) {
    return NextResponse.json({
      ready: false,
      missing: status.missing,
      hasBaseUrl: Boolean(status.baseUrl),
      hasApiToken: false,
      baseUrlHost: null,
    });
  }

  try {
    const client = createCanvasAdminClient();
    const probe = await client.probeAccess();
    const lti = await client.probeStudentAlertsLtiInstallation();
    return NextResponse.json({
      ready: true,
      missing: [],
      hasBaseUrl: true,
      hasApiToken: true,
      baseUrlHost: status.baseUrl
        ? new URL(
            status.baseUrl.startsWith("http") ? status.baseUrl : `https://${status.baseUrl}`,
          ).host
        : null,
      ...probe,
      lti,
    });
  } catch (error) {
    return NextResponse.json({
      ready: true,
      missing: [],
      hasBaseUrl: true,
      hasApiToken: true,
      baseUrlHost: status.baseUrl
        ? new URL(
            status.baseUrl.startsWith("http") ? status.baseUrl : `https://${status.baseUrl}`,
          ).host
        : null,
      error: error instanceof Error ? error.message : "Canvas probe failed.",
    });
  }
}
