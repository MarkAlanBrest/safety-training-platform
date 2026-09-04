export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { demoCourse } from "@/lib/mason";
import { requireAdmin } from "@/lib/admin-session";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  if (slug === "demo") return Response.json(demoCourse);

  const course = await prisma.masonCourse.findUnique({
    where: { slug },
    include: {
      sections: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          title: true,
          position: true,
          fileName: true,
          lessonPlan: true,
        },
      },
    },
  });

  if (!course) {
    return Response.json({ error: "Course not found." }, { status: 404 });
  }

  return Response.json(course);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  const { slug } = await params;
  const body = await request.json();
  const course = await prisma.masonCourse.update({
    where: { slug },
    data: { published: Boolean(body.published) },
  });
  return Response.json(course);
}
