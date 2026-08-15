export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getToolJwks } from "@/lib/lti/tool-jwk";

export async function GET() {
  return NextResponse.json(getToolJwks(), {
    headers: {
      "Cache-Control": "public, max-age=300",
    },
  });
}
