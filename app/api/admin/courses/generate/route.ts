export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/admin-session";
import {
  AI_COURSE_SOURCE_EXTENSIONS,
  MAX_AI_COURSE_SOURCE_BYTES,
  MAX_AI_COURSE_TOTAL_SOURCE_BYTES,
  generateAiCourse,
  type AiCourseSource,
} from "@/lib/ai-course-generator";
import { slugify } from "@/lib/mason";
import { prisma } from "@/lib/prisma";

const MAX_SOURCE_COUNT = 8;

function extension(name: string) {
  return name.split(".").pop()?.toLowerCase() || "";
}

export async function POST(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const form = await request.formData();
    const brief = String(form.get("brief") || "").trim();
    const requestedTitle = String(form.get("title") || "").trim();
    const audience = String(form.get("audience") || "").trim();
    const estimatedMinutes = Math.max(10, Math.min(240, Number(form.get("estimatedMinutes")) || 30));
    const questionCount = Math.max(3, Math.min(20, Number(form.get("questionCount")) || 8));
    const files = form.getAll("sources").filter((item): item is File => item instanceof File && item.size > 0);

    if (brief.length < 20) {
      return Response.json(
        { error: "Describe the course in at least a sentence so AI knows what success looks like." },
        { status: 400 },
      );
    }
    if (brief.length > 8000) {
      return Response.json({ error: "The course description is limited to 8,000 characters." }, { status: 400 });
    }
    if (files.length > MAX_SOURCE_COUNT) {
      return Response.json({ error: `Upload no more than ${MAX_SOURCE_COUNT} supporting files.` }, { status: 400 });
    }

    let totalBytes = 0;
    const sources: AiCourseSource[] = [];
    for (const file of files) {
      const ext = extension(file.name);
      if (!AI_COURSE_SOURCE_EXTENSIONS.includes(ext as (typeof AI_COURSE_SOURCE_EXTENSIONS)[number])) {
        return Response.json(
          { error: `${file.name} is not supported. Use PDF, DOCX, PPTX, TXT, or Markdown files.` },
          { status: 400 },
        );
      }
      if (file.size > MAX_AI_COURSE_SOURCE_BYTES) {
        return Response.json({ error: `${file.name} exceeds the 20 MB per-file limit.` }, { status: 400 });
      }
      totalBytes += file.size;
      if (totalBytes > MAX_AI_COURSE_TOTAL_SOURCE_BYTES) {
        return Response.json({ error: "Supporting files are limited to 45 MB total." }, { status: 400 });
      }
      sources.push({
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        bytes: Buffer.from(await file.arrayBuffer()),
      });
    }

    const generated = await generateAiCourse({
      brief,
      requestedTitle,
      audience,
      estimatedMinutes,
      questionCount,
      sources,
    });

    const baseSlug = slugify(generated.title) || "ai-course";
    let slug = baseSlug;
    let suffix = 2;
    while (await prisma.masonCourse.findUnique({ where: { slug } })) slug = `${baseSlug}-${suffix++}`;

    const course = await prisma.masonCourse.create({
      data: {
        title: generated.title,
        slug,
        description: generated.description || null,
        audience: generated.audience || null,
        theme: generated.theme,
        intensity: estimatedMinutes <= 20 ? "essentials" : estimatedMinutes >= 75 ? "comprehensive" : "standard",
        estimatedMinutes: generated.estimatedMinutes,
        courseType: "native",
        displayMode: "webpage",
        published: false,
        sections: {
          create: generated.sections.map((section, index) => ({
            title: section.title,
            position: index + 1,
            estimatedMinutes: section.estimatedMinutes,
            fileName: sources.length ? sources.map((source) => source.name).join(", ").slice(0, 240) : "AI course brief",
            lessonPlan: section.lessonPlan as unknown as Prisma.InputJsonValue,
          })),
        },
      },
      select: {
        id: true,
        title: true,
        slug: true,
        published: true,
        _count: { select: { sections: true } },
      },
    });

    return Response.json(
      {
        course,
        adminUrl: `/admin/courses/${course.slug}`,
        previewUrl: `/training/${course.slug}`,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("AI course generation failed:", error);
    const message = error instanceof Error ? error.message : "The course could not be generated.";
    return Response.json({ error: message }, { status: 500 });
  }
}
