export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-session";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const { slug } = await params;
    const body = await request.json();
    const sectionIds = Array.isArray(body.sectionIds)
      ? body.sectionIds.map(Number)
      : [];
    const course = await prisma.masonCourse.findUnique({
      where: { slug },
      include: { sections: { select: { id: true } } },
    });
    if (!course) {
      return Response.json({ error: "Course not found." }, { status: 404 });
    }
    if (
      sectionIds.length !== course.sections.length ||
      !sectionIds.every((id) => course.sections.some((section) => section.id === id))
    ) {
      return Response.json({ error: "Invalid section order." }, { status: 400 });
    }

    await prisma.$transaction(
      sectionIds.map((id, index) =>
        prisma.masonSection.update({
          where: { id },
          data: { position: index + 1 },
        }),
      ),
    );
    await prisma.masonCourse.update({
      where: { id: course.id },
      data: { updatedAt: new Date() },
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error("Section reorder failed:", error);
    return Response.json({ error: "Sections could not be reordered." }, { status: 500 });
  }
}
