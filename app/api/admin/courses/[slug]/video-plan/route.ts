export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/admin-session";
import { updateVideoCoursePlan } from "@/lib/video-course-create";
import { normalizeVideoPlan } from "@/lib/video";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  const { slug } = await params;
  const { prisma } = await import("@/lib/prisma");
  const course = await prisma.masonCourse.findUnique({
    where: { slug },
    include: { sections: { orderBy: { position: "asc" }, take: 1 } },
  });
  if (!course || course.courseType !== "video") {
    return Response.json({ error: "Video course not found." }, { status: 404 });
  }

  const plan = normalizeVideoPlan(course.sections[0]?.lessonPlan, course.title);
  if (!plan) {
    return Response.json({ error: "The video plan could not be loaded." }, { status: 500 });
  }

  return Response.json({ course, plan });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const { slug } = await params;
    const body = await request.json();
    const plan = normalizeVideoPlan(body.plan, String(body.title || ""));
    if (!plan) {
      return Response.json({ error: "The video plan is invalid." }, { status: 400 });
    }
    const saved = await updateVideoCoursePlan(slug, plan);
    return Response.json({ plan: saved });
  } catch (error) {
    console.error("Video plan update failed:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "The video plan could not be saved." },
      { status: 400 },
    );
  }
}
