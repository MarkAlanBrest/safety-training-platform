export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/admin-session";
import {
  AI_COURSE_SOURCE_EXTENSIONS,
  MAX_AI_COURSE_SOURCE_BYTES,
  MAX_AI_COURSE_TOTAL_SOURCE_BYTES,
  startAiCourseGeneration,
  pollAiCourseGeneration,
  cancelAiCourseGeneration,
  type AiCourseSource,
  type GeneratedAiCourse,
} from "@/lib/ai-course-generator";
import { slugify } from "@/lib/mason";
import type { PlayerSettings } from "@/lib/mason";
import {
  addGeneratedCoursePictures,
  attachPowerPointCoursePictures,
  type PowerPointPictureInput,
} from "@/lib/ai-course-images";
import { isCourseTheme } from "@/lib/course-options";
import { prisma } from "@/lib/prisma";

const MAX_SOURCE_COUNT = 8;
const DATABASE_TIMEOUT_MS = 12_000;

type CourseJobSettings = {
  requestedTitle: string;
  requestedTheme: string;
  displayMode: "webpage" | "slideshow";
  pictureMode: "source" | "ai" | "none";
  estimatedMinutes: number;
  appearance: PlayerSettings["appearance"];
  toolbarStyle: PlayerSettings["toolbarStyle"];
  aiCoach: PlayerSettings["aiCoach"];
  knowledgeScope: PlayerSettings["knowledgeScope"];
};

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

function readJobSettings(body: Record<string, unknown>): CourseJobSettings | null {
  const displayMode = String(body.displayMode || "webpage");
  const pictureMode = String(body.pictureMode || "source");
  const requestedTheme = String(body.requestedTheme || "auto");
  const appearance = String(body.appearance || "light");
  const toolbarStyle = String(body.toolbarStyle || "guided");
  const aiCoach = String(body.aiCoach || "ask");
  const knowledgeScope = String(body.knowledgeScope || "course");
  if (!["webpage", "slideshow"].includes(displayMode)) return null;
  if (!["source", "ai", "none"].includes(pictureMode)) return null;
  if (requestedTheme !== "auto" && !isCourseTheme(requestedTheme)) return null;
  if (!["light", "dark"].includes(appearance) || !["minimal", "guided"].includes(toolbarStyle)) return null;
  if (!["off", "ask", "guided"].includes(aiCoach) || !["course", "expanded"].includes(knowledgeScope)) return null;
  return {
    requestedTitle: String(body.requestedTitle || "").trim().slice(0, 200),
    requestedTheme,
    displayMode: displayMode as CourseJobSettings["displayMode"],
    pictureMode: pictureMode as CourseJobSettings["pictureMode"],
    estimatedMinutes: Math.max(10, Math.min(240, Number(body.estimatedMinutes) || 30)),
    appearance: appearance as PlayerSettings["appearance"],
    toolbarStyle: toolbarStyle as PlayerSettings["toolbarStyle"],
    aiCoach: aiCoach as PlayerSettings["aiCoach"],
    knowledgeScope: knowledgeScope as PlayerSettings["knowledgeScope"],
  };
}

async function saveCompletedCourse(
  jobId: string,
  generated: GeneratedAiCourse,
  settings: CourseJobSettings,
  sources: AiCourseSource[] = [],
  sourcePictures: PowerPointPictureInput[] = [],
) {
  const marker = `AI generation ${jobId}`;
  const existing = await prisma.masonSection.findFirst({
    where: { fileName: marker },
    select: {
      course: {
        select: { title: true, slug: true },
      },
    },
  });
  if (existing) {
    return {
      adminUrl: `/admin/courses/${existing.course.slug}`,
      previewUrl: `/training/${existing.course.slug}`,
    };
  }

  if (settings.pictureMode === "source") {
    await attachPowerPointCoursePictures(generated, sources, sourcePictures);
  } else if (settings.pictureMode === "ai") {
    await addGeneratedCoursePictures(generated);
  }

  const baseSlug = slugify(generated.title) || "ai-course";
  const jobSuffix = jobId.replace(/^resp_/, "").slice(-8).toLowerCase();
  const slug = `${baseSlug}-${jobSuffix}`;
  const playerSettings: PlayerSettings = {
    appearance: settings.appearance,
    toolbarStyle: settings.toolbarStyle,
    aiCoach: settings.aiCoach,
    knowledgeScope: settings.knowledgeScope,
  };

  const course = await withTimeout(prisma.masonCourse.upsert({
    where: { slug },
    update: {},
    create: {
      title: generated.title,
      slug,
      description: generated.description || null,
      audience: generated.audience || null,
      theme: settings.requestedTheme === "auto" ? generated.theme : settings.requestedTheme,
      intensity: settings.estimatedMinutes <= 20 ? "essentials" : settings.estimatedMinutes >= 75 ? "comprehensive" : "standard",
      estimatedMinutes: generated.estimatedMinutes,
      courseType: "native",
      displayMode: settings.displayMode,
      published: false,
      sections: {
        create: generated.sections.map((section, index) => ({
          title: section.title,
          position: index + 1,
          estimatedMinutes: section.estimatedMinutes,
          fileName: marker,
          lessonPlan: {
            ...section.lessonPlan,
            playerSettings,
          } as unknown as Prisma.InputJsonValue,
        })),
      },
    },
    select: { slug: true },
  }), DATABASE_TIMEOUT_MS, "The generated course could not be saved because storage did not respond.");

  return {
    adminUrl: `/admin/courses/${course.slug}`,
    previewUrl: `/training/${course.slug}`,
  };
}

export async function POST(request: Request) {
  try {
    const unauthorized = await withTimeout(
      requireAdmin(request),
      DATABASE_TIMEOUT_MS,
      "The administrator session check timed out.",
    );
    if (unauthorized) return unauthorized;

    if (request.headers.get("content-type")?.includes("application/json")) {
      const body = (await request.json()) as Record<string, unknown>;
      const jobId = String(body.jobId || "");
      const settings = readJobSettings(body);
      if (!settings || !/^resp_[a-zA-Z0-9_-]+$/.test(jobId)) {
        return Response.json({ error: "The background course job settings are invalid." }, { status: 400 });
      }
      const result = await pollAiCourseGeneration(jobId, settings.requestedTitle);
      if (!result.course) {
        return Response.json({ jobId, status: result.status }, { status: 202 });
      }
      if (settings.pictureMode === "source") {
        return Response.json({ jobId, status: "awaiting_sources" }, { status: 202 });
      }
      const saved = await saveCompletedCourse(jobId, result.course, settings);
      return Response.json({ jobId, status: "completed", ...saved }, { status: 201 });
    }

    const form = await request.formData();
    const jobId = String(form.get("jobId") || "");
    const brief = String(form.get("brief") || "").trim();
    const requestedTitle = String(form.get("title") || "").trim();
    const audience = String(form.get("audience") || "").trim();
    const displayMode = String(form.get("displayMode") || "webpage");
    const pictureMode = String(form.get("pictureMode") || "source");
    const requestedTheme = String(form.get("theme") || "auto");
    const appearance = String(form.get("appearance") || "light");
    const toolbarStyle = String(form.get("toolbarStyle") || "guided");
    const aiCoach = String(form.get("aiCoach") || "ask");
    const knowledgeScope = String(form.get("knowledgeScope") || "course");
    const estimatedMinutes = Math.max(10, Math.min(240, Number(form.get("estimatedMinutes")) || 30));
    const questionCount = Math.max(3, Math.min(20, Number(form.get("questionCount")) || 8));
    const files = form.getAll("sources").filter((item): item is File => item instanceof File && item.size > 0);
    const pictureFiles = form
      .getAll("sourcePictures")
      .filter((item): item is File => item instanceof File && item.size > 0);

    if (!jobId && brief.length < 20) {
      return Response.json(
        { error: "Describe the course in at least a sentence so AI knows what success looks like." },
        { status: 400 },
      );
    }
    if (!jobId && brief.length > 8000) {
      return Response.json({ error: "The course description is limited to 8,000 characters." }, { status: 400 });
    }
    if (!['webpage', 'slideshow'].includes(displayMode)) {
      return Response.json({ error: "Choose either scrolling page or slide presentation." }, { status: 400 });
    }
    if (!["source", "ai", "none"].includes(pictureMode)) {
      return Response.json({ error: "Choose a valid picture option." }, { status: 400 });
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
    if (pictureFiles.length > 12 || pictureFiles.some((file) => file.size > 350 * 1024)) {
      return Response.json({ error: "The prepared PowerPoint pictures are too large." }, { status: 400 });
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

    if (jobId) {
      const settings = readJobSettings({
        requestedTitle,
        requestedTheme,
        displayMode,
        pictureMode,
        estimatedMinutes,
        appearance,
        toolbarStyle,
        aiCoach,
        knowledgeScope,
      });
      if (!settings || !/^resp_[a-zA-Z0-9_-]+$/.test(jobId)) {
        return Response.json({ error: "The background course job settings are invalid." }, { status: 400 });
      }
      let pictureManifest: Array<Record<string, unknown>> = [];
      try {
        const rawManifest = String(form.get("sourcePictureManifest") || "[]");
        const parsed = JSON.parse(rawManifest) as unknown;
        if (!Array.isArray(parsed) || parsed.length !== pictureFiles.length) throw new Error("invalid manifest");
        pictureManifest = parsed as Array<Record<string, unknown>>;
      } catch {
        return Response.json({ error: "The prepared PowerPoint picture details are invalid." }, { status: 400 });
      }
      const sourcePictures: PowerPointPictureInput[] = await Promise.all(
        pictureFiles.map(async (file, index) => ({
          bytes: Buffer.from(await file.arrayBuffer()),
          mimeType: file.type || "image/jpeg",
          slideNumber: Math.max(1, Math.min(1000, Number(pictureManifest[index].slideNumber) || 1)),
          title: String(pictureManifest[index].title || "PowerPoint picture").slice(0, 300),
          context: String(pictureManifest[index].context || "").slice(0, 6000),
          sourceName: String(pictureManifest[index].sourceName || "PowerPoint").slice(0, 300),
        })),
      );
      const result = await pollAiCourseGeneration(jobId, settings.requestedTitle);
      if (!result.course) {
        return Response.json({ jobId, status: result.status }, { status: 202 });
      }
      const saved = await saveCompletedCourse(
        jobId,
        result.course,
        settings,
        sources,
        sourcePictures,
      );
      return Response.json({ jobId, status: "completed", ...saved }, { status: 201 });
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

    const job = await startAiCourseGeneration({
      brief,
      requestedTitle,
      audience,
      estimatedMinutes,
      questionCount,
      displayMode: displayMode as "webpage" | "slideshow",
      pictureMode: pictureMode as "source" | "ai" | "none",
      requestedTheme: requestedTheme === "auto" ? undefined : requestedTheme,
      sources,
    });
    return Response.json(
      {
        jobId: job.id,
        status: job.status,
      },
      { status: 202 },
    );
  } catch (error) {
    console.error("AI course generation failed:", error);
    const message = error instanceof Error ? error.message : "The course could not be generated.";
    const timedOut = /timed out|longer than two minutes|did not respond/i.test(message);
    return Response.json({ error: message }, { status: timedOut ? 504 : 500 });
  }
}

export async function DELETE(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const jobId = new URL(request.url).searchParams.get("jobId") || "";
  if (!/^resp_[a-zA-Z0-9_-]+$/.test(jobId)) {
    return Response.json({ error: "The background course job identifier is invalid." }, { status: 400 });
  }
  try {
    await cancelAiCourseGeneration(jobId);
    return Response.json({ canceled: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The background course job could not be canceled.";
    return Response.json({ error: message }, { status: 500 });
  }
}
