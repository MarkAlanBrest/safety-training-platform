import "server-only";

import { Prisma } from "@prisma/client";
import { isCourseTheme } from "@/lib/course-options";
import { slugify } from "@/lib/mason";
import { prisma } from "@/lib/prisma";
import {
  buildDefaultVideoPlan,
  normalizeVideoCue,
  normalizeVideoPlan,
  parseYouTubeUrl,
  type VideoCue,
  type VideoPlan,
} from "@/lib/video";

export type VideoCourseInitInput = {
  title: string;
  description?: string;
  audience?: string;
  theme?: string;
  estimatedMinutes?: number;
  videoUrl: string;
  cues?: VideoCue[];
};

export async function createVideoCourse(input: VideoCourseInitInput) {
  const title = input.title.trim();
  if (!title) throw new Error("A course title is required.");

  const source = parseYouTubeUrl(input.videoUrl);
  if (!source) throw new Error("Enter a valid YouTube video URL.");

  const theme = input.theme || "heritage";
  if (!isCourseTheme(theme)) throw new Error("Select a valid course theme.");

  const description = String(input.description || "").trim();
  const audience = String(input.audience || "").trim();
  const estimatedMinutes = Math.max(
    10,
    Math.min(100000, Number(input.estimatedMinutes) || 30),
  );

  const cues = (input.cues || [])
    .map((item) => normalizeVideoCue(item))
    .filter((item): item is VideoCue => Boolean(item))
    .sort((a, b) => a.atSeconds - b.atSeconds);

  const lessonPlan = buildDefaultVideoPlan({
    title,
    description,
    source,
    cues,
  });

  const baseSlug = slugify(title) || "video-course";
  let slug = baseSlug;
  let suffix = 2;
  while (await prisma.masonCourse.findUnique({ where: { slug } })) slug = `${baseSlug}-${suffix++}`;

  const course = await prisma.masonCourse.create({
    data: {
      title,
      slug,
      description: description || null,
      audience: audience || null,
      theme,
      intensity: "standard",
      estimatedMinutes,
      courseType: "video",
      published: false,
      sections: {
        create: [
          {
            title: "Video lesson",
            position: 1,
            estimatedMinutes,
            fileName: source.videoId,
            lessonPlan: lessonPlan as Prisma.InputJsonValue,
          },
        ],
      },
    },
  });

  return course;
}

export async function updateVideoCoursePlan(slug: string, plan: VideoPlan) {
  const course = await prisma.masonCourse.findUnique({
    where: { slug },
    include: { sections: { orderBy: { position: "asc" }, take: 1 } },
  });
  if (!course || course.courseType !== "video") {
    throw new Error("Video course not found.");
  }
  const section = course.sections[0];
  if (!section) throw new Error("This video course has no lesson section.");

  const normalized = normalizeVideoPlan(plan, course.title);
  if (!normalized) throw new Error("The video plan is invalid.");

  await prisma.masonSection.update({
    where: { id: section.id },
    data: {
      lessonPlan: normalized as Prisma.InputJsonValue,
      fileName: normalized.source.videoId,
      updatedAt: new Date(),
    },
  });

  await prisma.masonCourse.update({
    where: { id: course.id },
    data: {
      title: normalized.title,
      updatedAt: new Date(),
    },
  });

  return normalized;
}
