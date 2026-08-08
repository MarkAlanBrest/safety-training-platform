export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { serveClassroomDeck } from "@/lib/classroom-deck-serve";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  return serveClassroomDeck({
    slug,
    publicEmbed: true,
    rangeHeader: request.headers.get("range"),
  });
}

export async function HEAD(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const response = await GET(request, context);
  return new Response(null, { status: response.status, headers: response.headers });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Range, Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}
