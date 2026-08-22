export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-session";

export async function GET(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  const courses = await prisma.masonCourse.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      _count: {
        select: {
          sections: true,
          enrollmentCodes: true,
          enrollments: true,
        },
      },
      enrollmentCodes: {
        where: { status: "available" },
        select: { id: true },
      },
    },
  });

  return Response.json(
    courses.map(({ enrollmentCodes, ...course }) => ({
      ...course,
      availableCodes: enrollmentCodes.length,
    })),
  );
}
