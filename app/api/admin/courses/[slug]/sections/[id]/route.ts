export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";

async function findSection(slug: string, sectionId: number) {
  return prisma.masonSection.findFirst({
    where: {
      id: sectionId,
      course: { slug },
    },
    select: {
      id: true,
      courseId: true,
    },
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const { slug, id } = await params;
    const sectionId = Number(id);
    if (!Number.isInteger(sectionId)) {
      return Response.json({ error: "Invalid section." }, { status: 400 });
    }

    const existing = await findSection(slug, sectionId);
    if (!existing) {
      return Response.json({ error: "Section not found." }, { status: 404 });
    }

    await prisma.$transaction(async (transaction) => {
      await transaction.masonSection.delete({ where: { id: existing.id } });
      const remaining = await transaction.masonSection.findMany({
        where: { courseId: existing.courseId },
        orderBy: { position: "asc" },
        select: { id: true },
      });
      for (let index = 0; index < remaining.length; index += 1) {
        await transaction.masonSection.update({
          where: { id: remaining[index].id },
          data: { position: index + 1 },
        });
      }
      await transaction.masonCourse.update({
        where: { id: existing.courseId },
        data: { updatedAt: new Date() },
      });
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error("Section delete failed:", error);
    return Response.json({ error: "The section could not be deleted." }, { status: 500 });
  }
}
