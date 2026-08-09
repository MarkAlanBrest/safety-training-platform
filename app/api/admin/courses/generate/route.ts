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
import type { PlayerSettings } from "@/lib/mason";
import { isCourseTheme } from "@/lib/course-options";
import { prisma } from "@/lib/prisma";

const MAX_SOURCE_COUNT = 8;
const DATABASE_TIMEOUT_MS = 12_000;

async function withTimeout<T>(promise: Promise<T>, milliseconds: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), milliseconds);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function extension(name: string) {
  return name.split(".").pop()?.toLowerCase() || "";
}

export async function POST(request: Request) {
  try {
    const unauthorized = await withTimeout(
      requireAdmin(request),
      DATABASE_TIMEOUT_MS,
      "The administrator session check timed out.",
    );
    if (unauthorized) return unauthorized;

    const form = await request.formData();
    const brief = String(form.get("brief") || "").trim();
    const requestedTitle = String(form.get("title") || "").trim();
    const audience = String(form.get("audience") || "").trim();
    const displayMode = String(form.get("displayMode") || "webpage");
    const requestedTheme = String(form.get("theme") || "auto");
    const appearance = String(form.get("appearance") || "light");
    const toolbarStyle = String(form.get("toolbarStyle") || "guided");
    const aiCoach = String(form.get("aiCoach") || "ask");
    const knowledgeScope = String(form.get("knowledgeScope") || "course");
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
    if (!['webpage', 'slideshow'].includes(displayMode)) {
      return Response.json({ error: "Choose either scrolling page or slide presentation." }, { status: 400 });
    }
    if (requestedTheme !== "auto" && !isCourseTheme(requestedTheme)) {
      return Response.json({ error: "Choose a valid course theme." }, { status: 400 });
    }
    if (!["light", "dark"].includes(appearance) || !["minimal", "guided"].includes(toolbarStyle)) {
      return Response.json({ error: "Choose valid appearance and toolbar settings." }, { status: 400 });
    }
    if (!["off", "ask", "guided"].includes(aiCoach) || !["course", "expanded"].includes(knowledgeScope)) {
      return Response.json({ error: "Choose valid AI instructor settings." }, { status: 400 });
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

    // Confirm the draft can be saved before making the paid generation call.
    // This prevents a full course from being generated and then discarded when
    // the database provider is unavailable or over quota.
    try {
      await withTimeout(
        prisma.masonCourse.findFirst({ select: { id: true } }),
        DATABASE_TIMEOUT_MS,
        "The course database did not respond in time.",
      );
    } catch {
      return Response.json(
        {
          error:
            "Course storage is currently unavailable. AI generation was not started and no generation cost was incurred.",
        },
        { status: 503 },
      );
    }

    const generated = await generateAiCourse({
      brief,
      requestedTitle,
      audience,
      estimatedMinutes,
      questionCount,
      displayMode: displayMode as "webpage" | "slideshow",
      requestedTheme: requestedTheme === "auto" ? undefined : requestedTheme,
      sources,
    });
    const playerSettings: PlayerSettings = {
      appearance: appearance as PlayerSettings["appearance"],
      toolbarStyle: toolbarStyle as PlayerSettings["toolbarStyle"],
      aiCoach: aiCoach as PlayerSettings["aiCoach"],
      knowledgeScope: knowledgeScope as PlayerSettings["knowledgeScope"],
    };

    const baseSlug = slugify(generated.title) || "ai-course";
    let slug = baseSlug;
    let suffix = 2;
    while (await prisma.masonCourse.findUnique({ where: { slug } })) slug = `${baseSlug}-${suffix++}`;

    const course = await withTimeout(prisma.masonCourse.create({
      data: {
        title: generated.title,
        slug,
        description: generated.description || null,
        audience: generated.audience || null,
        theme: requestedTheme === "auto" ? generated.theme : requestedTheme,
        intensity: estimatedMinutes <= 20 ? "essentials" : estimatedMinutes >= 75 ? "comprehensive" : "standard",
        estimatedMinutes: generated.estimatedMinutes,
        courseType: "native",
        displayMode,
        published: false,
        sections: {
          create: generated.sections.map((section, index) => ({
            title: section.title,
            position: index + 1,
            estimatedMinutes: section.estimatedMinutes,
            fileName: sources.length ? sources.map((source) => source.name).join(", ").slice(0, 240) : "AI course brief",
            lessonPlan: {
              ...section.lessonPlan,
              playerSettings,
            } as unknown as Prisma.InputJsonValue,
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
    }), DATABASE_TIMEOUT_MS, "The generated course could not be saved because storage did not respond.");

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
    const timedOut = /timed out|longer than two minutes|did not respond/i.test(message);
    return Response.json({ error: message }, { status: timedOut ? 504 : 500 });
  }
}
