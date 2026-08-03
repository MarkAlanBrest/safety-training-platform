export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-session";
import { generateClassroomPlan } from "@/lib/classroom-generator";
import {
  ClassroomBuilderConfig,
  defaultClassroomBuilderConfig,
  estimateClassroomCourse,
} from "@/lib/classroom-builder";
import { classroomSlideAssetPath } from "@/lib/classroom";
import { parsePptx, slidesForClassroomPlan } from "@/lib/ppt-ingest";
import { slugify } from "@/lib/mason";

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

function parseBuilderConfig(raw: string | null): ClassroomBuilderConfig {
  if (!raw) return defaultClassroomBuilderConfig();
  try {
    const parsed = JSON.parse(raw) as ClassroomBuilderConfig;
    return defaultClassroomBuilderConfig(parsed);
  } catch {
    return defaultClassroomBuilderConfig();
  }
}

export async function POST(request: Request) {
  try {
    const unauthorized = await requireAdmin(request);
    if (unauthorized) return unauthorized;

    const form = await request.formData();
    const title = String(form.get("title") || "").trim();
    const description = String(form.get("description") || "").trim();
    const published = String(form.get("published") || "false") === "true";
    const config = parseBuilderConfig(String(form.get("config") || ""));
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
    if (file.size > MAX_UPLOAD_BYTES) {
      return Response.json(
        {
          error:
            "This file is too large for upload (max 4 MB on the server). Try exporting a smaller deck or compressing images in PowerPoint.",
        },
        { status: 400 },
      );
    }

    const mergedConfig = defaultClassroomBuilderConfig({
      ...config,
      knowledge: {
        ...config.knowledge,
        courseName: title,
        description: description || config.knowledge.description,
      },
    });

    const buffer = new Uint8Array(await file.arrayBuffer());
    const parsedSlides = parsePptx(buffer);

    let slug = slugify(title);
    const existing = await prisma.masonCourse.findUnique({ where: { slug } });
    if (existing) slug = `${slug}-${Date.now().toString(36)}`;

    const slides = slidesForClassroomPlan(parsedSlides, slug);
    const plan = await generateClassroomPlan(parsedSlides, slides, title, mergedConfig);
    const estimates = estimateClassroomCourse(plan.slides.length, mergedConfig);

    const course = await prisma.$transaction(async (tx) => {
      const created = await tx.masonCourse.create({
        data: {
          title,
          slug,
          description:
            description ||
            mergedConfig.knowledge.description ||
            `AI classroom lesson built from ${file.name}`,
          courseType: "classroom",
          displayMode: "classroom",
          published,
          estimatedMinutes: estimates.courseLengthMinutes,
          intensity:
            mergedConfig.knowledge.difficulty === "beginner"
              ? "essentials"
              : mergedConfig.knowledge.difficulty === "advanced"
                ? "comprehensive"
                : "standard",
          sections: {
            create: {
              title: plan.title,
              position: 1,
              estimatedMinutes: estimates.courseLengthMinutes,
              fileName: file.name,
              lessonPlan: plan,
            },
          },
        },
        select: { id: true, title: true, slug: true, published: true },
      });

      const assets = parsedSlides
        .filter((slide) => slide.image)
        .map((slide) => ({
          courseId: created.id,
          path: classroomSlideAssetPath(slide.index),
          mimeType: slide.image!.mimeType,
          content: Buffer.from(slide.image!.bytes),
        }));

      if (assets.length) {
        await tx.scormAsset.createMany({ data: assets });
      }

      return created;
    });

    return Response.json({
      course,
      slideCount: plan.slides.length,
      published: course.published,
      estimates,
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
