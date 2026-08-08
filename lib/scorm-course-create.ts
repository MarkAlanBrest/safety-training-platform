import "server-only";

import { Prisma } from "@prisma/client";
import { defaultClassroomBuilderConfig } from "@/lib/classroom-builder";
import { isCourseTheme } from "@/lib/course-options";
import { slugify } from "@/lib/mason";
import { prisma } from "@/lib/prisma";
import { parseScormPackage } from "@/lib/scorm";
import { buildDefaultScormLessonPlan } from "@/lib/scorm-instructor";

export const MAX_SCORM_ZIP_BYTES = 25 * 1024 * 1024;

export type ScormCourseInitInput = {
  title: string;
  description?: string;
  audience?: string;
  theme?: string;
  estimatedMinutes?: number;
  voiceProvider?: string;
  voice?: string;
  fileName: string;
};

export async function createScormCourseShell(input: ScormCourseInitInput) {
  const title = input.title.trim();
  if (!title) throw new Error("A course title is required.");

  const theme = input.theme || "heritage";
  if (!isCourseTheme(theme)) throw new Error("Select a valid course theme.");

  const description = String(input.description || "").trim();
  const audience = String(input.audience || "").trim();
  const estimatedMinutes = Math.max(
    10,
    Math.min(100000, Number(input.estimatedMinutes) || 60),
  );
  const voiceProvider = String(input.voiceProvider || "browser");
  const voice = String(input.voice || "onyx").trim();

  const baseSlug = slugify(title) || "scorm-course";
  let slug = baseSlug;
  let suffix = 2;
  while (await prisma.masonCourse.findUnique({ where: { slug } })) slug = `${baseSlug}-${suffix++}`;

  const defaults = defaultClassroomBuilderConfig();
  const config = defaultClassroomBuilderConfig({
    teaching: {
      ...defaults.teaching,
      voiceProvider: voiceProvider === "premium" ? "premium" : "browser",
      voice: /^[a-z0-9_-]{1,40}$/i.test(voice) ? voice : "onyx",
    },
  });
  const lessonPlan = buildDefaultScormLessonPlan({ title, description, config });

  const course = await prisma.masonCourse.create({
    data: {
      title,
      slug,
      description: description || null,
      audience: audience || null,
      theme,
      intensity: "standard",
      estimatedMinutes,
      courseType: "scorm",
      published: false,
      sections: {
        create: [
          {
            title: "SCORM package",
            position: 1,
            estimatedMinutes,
            fileName: input.fileName,
            lessonPlan: lessonPlan as Prisma.InputJsonValue,
          },
        ],
      },
    },
  });

  return course;
}

export async function importScormZipIntoCourse(courseId: number, zip: Uint8Array) {
  const parsed = parseScormPackage(zip);

  await prisma.$transaction(async (transaction) => {
    await transaction.scormAsset.deleteMany({ where: { courseId } });
    await transaction.scormAsset.createMany({
      data: parsed.assets.map((asset) => ({
        courseId,
        path: asset.path,
        mimeType: asset.mimeType,
        content: Buffer.from(asset.content),
      })),
    });
    await transaction.masonCourse.update({
      where: { id: courseId },
      data: {
        scormVersion: parsed.version,
        scormEntryPoint: parsed.entryPoint,
      },
    });
  }, { timeout: 120000 });

  return parsed;
}

export function scormStagingPrefix(uploadId: string) {
  return `scorm/staging/${uploadId}/`;
}

export async function readStagedScormZip(courseId: number, uploadId: string) {
  const prefix = scormStagingPrefix(uploadId);
  const chunks = await prisma.scormAsset.findMany({
    where: { courseId, path: { startsWith: prefix } },
    orderBy: { path: "asc" },
  });
  if (!chunks.length) {
    throw new Error("The uploaded SCORM package could not be found.");
  }
  return Buffer.concat(chunks.map((item) => Buffer.from(item.content)));
}

export async function deleteStagedScormZip(courseId: number, uploadId: string) {
  await prisma.scormAsset.deleteMany({
    where: { courseId, path: { startsWith: scormStagingPrefix(uploadId) } },
  });
}
