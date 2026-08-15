export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getCanvasServerConfigStatus } from "@/lib/canvas/config";

export async function GET() {
  const status = getCanvasServerConfigStatus();
  return NextResponse.json({
    ready: status.ready,
    missing: status.missing,
    hasBaseUrl: Boolean(status.baseUrl),
    hasApiToken: status.missing.includes("CANVAS_API_TOKEN") === false,
    baseUrlHost: status.baseUrl
      ? (() => {
          try {
            return new URL(
              status.baseUrl.startsWith("http") ? status.baseUrl : `https://${status.baseUrl}`,
            ).host;
          } catch {
            return "invalid";
          }
        })()
      : null,
  });
}
