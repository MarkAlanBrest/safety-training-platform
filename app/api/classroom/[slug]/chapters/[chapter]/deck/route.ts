export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { serveClassroomDeck } from "@/lib/classroom-deck-serve";
import { getAdminSession } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string; chapter: string }> },
) {
  const { slug, chapter } = await params;
  const chapterPosition = Number(chapter);
  if (!Number.isInteger(chapterPosition) || chapterPosition < 1) {
    return new Response("Invalid chapter.", { status: 400 });
  }

  const course = await prisma.masonCourse.findUnique({
    where: { slug },
    select: { published: true, courseType: true },
  });
  if (!course || course.courseType !== "classroom") {
    return new Response("Course not found.", { status: 404 });
  }

  const admin = !course.published ? await getAdminSession(request) : null;
  return serveClassroomDeck({
    slug,
    chapterPosition,
    allowUnpublished: Boolean(admin),
  });
}
