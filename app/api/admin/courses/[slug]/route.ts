export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  isCourseIntensity,
  isCourseTheme,
} from "@/lib/course-options";
import { requireAdmin } from "@/lib/admin-session";
import { deleteScormAssetsForCourse } from "@/lib/scorm-asset-store";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const { slug } = await params;
    const course = await prisma.masonCourse.findUnique({
      where: { slug },
      include: {
        sections: {
          orderBy: { position: "asc" },
          select: {
            id: true,
            title: true,
            position: true,
            estimatedMinutes: true,
            fileName: true,
            lessonPlan: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        enrollmentCodes: {
          orderBy: { createdAt: "desc" },
          take: 250,
          include: {
            enrollment: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                progress: true,
                status: true,
              },
            },
          },
        },
        enrollments: {
          orderBy: { enrolledAt: "desc" },
          include: { code: { select: { code: true } } },
        },
      },
    });

    if (!course) {
      return Response.json({ error: "Course not found." }, { status: 404 });
    }

    return Response.json(course);
  } catch (error) {
    console.error("Course load failed:", error);
    const message =
      error instanceof Error &&
      (error.message.includes("recipientName") ||
        error.message.includes("company") ||
        error.message.includes("does not exist"))
        ? "The database schema is out of date. Run npm run db:init on the server."
        : "Course could not be loaded.";
    return Response.json({ error: message }, { status: 500 });
  }
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
    const title = String(body.title || "").trim();
    const theme = String(body.theme || "heritage");
    const intensity = String(body.intensity || "standard");
    const accentColor = String(body.accentColor || "").trim();
    const logoData = String(body.logoData || "").trim();
    const displayMode = String(body.displayMode || "webpage");
    const classroomVoiceProvider = String(body.classroomVoiceProvider || "");
    const classroomVoice = String(body.classroomVoice || "").trim();
    const scormNarrationMode = String(body.scormNarrationMode || "");

    if (!title || !isCourseTheme(theme) || !isCourseIntensity(intensity)) {
      return Response.json(
        { error: "Title, theme, and intensity are required." },
        { status: 400 },
      );
    }
    if (accentColor && !/^#[0-9a-f]{6}$/i.test(accentColor)) {
      return Response.json(
        { error: "Choose a valid six-digit accent color." },
        { status: 400 },
      );
    }
    if (!["webpage", "slideshow", "classroom"].includes(displayMode)) {
      return Response.json(
        { error: "Choose a valid course format." },
        { status: 400 },
      );
    }
    if (
      logoData &&
      (!/^data:image\/(?:png|jpeg|webp);base64,/i.test(logoData) ||
        logoData.length > 1_500_000)
    ) {
      return Response.json(
        { error: "The logo must be a PNG, JPEG, or WebP image under 1 MB." },
        { status: 400 },
      );
    }

    const course = await prisma.masonCourse.update({
      where: { slug },
      data: {
        title,
        description: String(body.description || "").trim() || null,
        audience: String(body.audience || "").trim() || null,
        theme,
        companyName: String(body.companyName || "").trim().slice(0, 120) || null,
        logoData: logoData || null,
        accentColor: accentColor || null,
        displayMode,
        intensity,
        estimatedMinutes: Math.max(
          10,
          Math.min(100000, Number(body.estimatedMinutes) || 60),
        ),
        published: Boolean(body.published),
      },
    });

    const savedVoiceProvider =
      course.courseType === "scorm" && ["package", "premium", "browser"].includes(scormNarrationMode)
        ? scormNarrationMode === "browser" ? "browser" : "premium"
        : classroomVoiceProvider;
    if (
      (course.courseType === "classroom" || course.courseType === "scorm") &&
      ["browser", "premium"].includes(savedVoiceProvider) &&
      /^[a-z0-9_-]{1,40}$/i.test(classroomVoice)
    ) {
      const sections = await prisma.masonSection.findMany({
        where: { courseId: course.id },
        select: { id: true, lessonPlan: true },
      });
      await prisma.$transaction(
        sections.flatMap((section) => {
          if (!section.lessonPlan || typeof section.lessonPlan !== "object" || Array.isArray(section.lessonPlan)) {
            return [];
          }
          const plan = section.lessonPlan as Record<string, unknown>;
          const config = plan.config && typeof plan.config === "object" && !Array.isArray(plan.config)
            ? (plan.config as Record<string, unknown>)
            : {};
          const teaching = config.teaching && typeof config.teaching === "object" && !Array.isArray(config.teaching)
            ? (config.teaching as Record<string, unknown>)
            : {};
          const settings = config.settings && typeof config.settings === "object" && !Array.isArray(config.settings)
            ? (config.settings as Record<string, unknown>)
            : {};
          return [
            prisma.masonSection.update({
              where: { id: section.id },
              data: {
                lessonPlan: {
                  ...plan,
                  config: {
                    ...config,
                    teaching: {
                      ...teaching,
                      voiceProvider: savedVoiceProvider,
                      voice: classroomVoice,
                    },
                    settings: {
                      ...settings,
                      speechVoice:
                        course.courseType === "scorm" && scormNarrationMode === "package"
                          ? false
                          : course.courseType === "scorm" && ["premium", "browser"].includes(scormNarrationMode)
                            ? true
                            : settings.speechVoice,
                    },
                  },
                } as Prisma.InputJsonValue,
              },
            }),
          ];
        }),
      );
    }

    return Response.json(course);
  } catch (error) {
    console.error("Course update failed:", error);
    return Response.json(
      { error: "The course could not be updated." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const { slug } = await params;
    const course = await prisma.masonCourse.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!course) {
      return Response.json({ error: "Course not found." }, { status: 404 });
    }

    await deleteScormAssetsForCourse(course.id);
    await prisma.$transaction([
      prisma.classroomAttempt.deleteMany({ where: { courseId: course.id } }),
      prisma.courseEnrollment.deleteMany({ where: { courseId: course.id } }),
      prisma.enrollmentCode.deleteMany({ where: { courseId: course.id } }),
      prisma.masonSection.deleteMany({ where: { courseId: course.id } }),
      prisma.masonCourse.delete({ where: { id: course.id } }),
      prisma.seedCourseSuppression.upsert({
        where: { slug },
        create: { slug },
        update: { suppressedAt: new Date() },
      }),
    ]);

    return Response.json({ success: true });
  } catch (error) {
    console.error("Course deletion failed:", error);
    return Response.json(
      { error: "The course could not be deleted." },
      { status: 500 },
    );
  }
}
