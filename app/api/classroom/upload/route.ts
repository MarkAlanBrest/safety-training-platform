export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-session";
import { generateClassroomPlanFromPptx } from "@/lib/classroom-generator";
import { slugify } from "@/lib/mason";

export async function POST(request: Request) {
  try {
    const unauthorized = await requireAdmin(request);
    if (unauthorized) return unauthorized;

    const form = await request.formData();
    const title = String(form.get("title") || "").trim();
    const description = String(form.get("description") || "").trim();
    const file = form.get("pptx");

    if (!title) {
      return Response.json({ error: "A course title is required." }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return Response.json({ error: "A PowerPoint file is required." }, { status: 400 });
    }
    if (!/\.pptx$/i.test(file.name)) {
      return Response.json(
        { error: "Only .pptx PowerPoint files are supported right now." },
        { status: 400 },
      );
    }

    const buffer = new Uint8Array(await file.arrayBuffer());
    const plan = await generateClassroomPlanFromPptx(buffer, title);

    let slug = slugify(title);
    const existing = await prisma.masonCourse.findUnique({ where: { slug } });
    if (existing) slug = `${slug}-${Date.now().toString(36)}`;

    const course = await prisma.masonCourse.create({
      data: {
        title,
        slug,
        description: description || `AI classroom lesson built from ${file.name}`,
        courseType: "classroom",
        displayMode: "classroom",
        published: false,
        sections: {
          create: {
            title: plan.title,
            position: 1,
            estimatedMinutes: Math.max(15, plan.slides.length * 4),
            fileName: file.name,
            lessonPlan: plan,
          },
        },
      },
      select: { id: true, title: true, slug: true },
    });

    return Response.json({
      course,
      slideCount: plan.slides.length,
      previewUrl: `/classroom/${course.slug}`,
      adminUrl: `/admin/courses/${course.slug}`,
    });
  } catch (error) {
    console.error("Classroom upload failed:", error);
    const message =
      error instanceof Error ? error.message : "The classroom could not be created.";
    const status = message.includes("Unauthorized") ? 401 : 500;
    return Response.json({ error: message }, { status });
  }
}
