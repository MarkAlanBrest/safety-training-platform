export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { serveClassroomDeck } from "@/lib/classroom-deck-serve";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string; chapter: string }> },
) {
  const { slug, chapter } = await params;
  const chapterPosition = Number(chapter);
  if (!Number.isInteger(chapterPosition) || chapterPosition < 1) {
    return new Response("Invalid chapter.", { status: 400 });
  }

  return serveClassroomDeck({
    slug,
    chapterPosition,
    publicEmbed: true,
    rangeHeader: request.headers.get("range"),
  });
}

export async function HEAD(
  request: Request,
  context: { params: Promise<{ slug: string; chapter: string }> },
) {
  const response = await GET(request, context);
  return new Response(null, {
    status: response.status,
    headers: response.headers,
  });
}
