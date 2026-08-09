import "server-only";

import { Prisma } from "@prisma/client";
import { defaultClassroomBuilderConfig, VOICE_OPTIONS } from "@/lib/classroom-builder";
import { isCourseTheme } from "@/lib/course-options";
import { slugify } from "@/lib/mason";
import { prisma } from "@/lib/prisma";
import { parseScormPackage } from "@/lib/scorm";
import {
  deleteScormAssetsForCourse,
  readScormAssetContent,
  readScormAssetsWithPrefix,
  replaceCourseAssetBlobs,
} from "@/lib/scorm-asset-store";
import { buildDefaultScormLessonPlan } from "@/lib/scorm-instructor";
import { MAX_SCORM_ZIP_BYTES } from "@/lib/scorm-limits";
import { parseScormNarrationDocument } from "@/lib/scorm-narration-document";

const NARRATION_SCRIPT_NAMES = new Set([
  "narration-script.txt",
  "narration.txt",
  "narration-script.example.txt",
]);

export { MAX_SCORM_ZIP_BYTES };

export type ScormCourseInitInput = {
  title: string;
  description?: string;
  audience?: string;
  theme?: string;
  estimatedMinutes?: number;
  voiceProvider?: string;
  narrationMode?: "package" | "premium" | "browser";
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
  const narrationMode = ["package", "premium", "browser"].includes(String(input.narrationMode))
    ? String(input.narrationMode)
    : String(input.voiceProvider || "package");
  const voiceProvider = narrationMode === "browser" ? "browser" : "premium";
  const requestedVoice = String(input.voice || "cedar").trim().toLowerCase();
  const voice = narrationMode === "browser"
    ? "mark"
    : VOICE_OPTIONS.some((option) => option.id === requestedVoice)
      ? requestedVoice
      : "cedar";

  const baseSlug = slugify(title) || "scorm-course";
  let slug = baseSlug;
  let suffix = 2;
  while (await prisma.masonCourse.findUnique({ where: { slug } })) slug = `${baseSlug}-${suffix++}`;

  const defaults = defaultClassroomBuilderConfig();
  const config = defaultClassroomBuilderConfig({
    teaching: {
      ...defaults.teaching,
      voiceProvider: voiceProvider === "browser" ? "browser" : "premium",
      voice,
    },
    settings: {
      ...defaults.settings,
      speechVoice: narrationMode !== "package",
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

export function narrationScriptFromPackage(
  assets: Array<{ path: string; content: Uint8Array }>,
) {
  const script = assets.find((asset) => {
    const base = asset.path.split("/").pop()?.toLowerCase() || "";
    return NARRATION_SCRIPT_NAMES.has(base);
  });
  if (!script) return null;
  const source = new TextDecoder().decode(script.content);
  const cues = parseScormNarrationDocument(source);
  if (!cues.length) return null;
  const normalized = source.replace(/\r\n/g, "\n");

  // Bracketed scripts commonly lead with authoring notes (format legend,
  // "don't feed this to the TTS engine" reminders) rather than learner-facing
  // welcome text, so never speak that preamble as the course opening.
  const usesBracketCues = /(?:^|\n)\s*\[[^\]\n]+\]\s*\n/.test(normalized);
  const firstCueHeader = normalized.search(
    /(?:^|\n)\s*(?:===\s*.+?\s*===|\[[^\]\n]+\]|(?:slide|page)\s+\d+\s*:?(?=\n|$)|(?:location|page|slide)\s*[:#-])/i,
  );
  const openingBlock = firstCueHeader > 0 ? normalized.slice(0, firstCueHeader).trim() : "";
  const opening = !usesBracketCues && openingBlock ? openingBlock : undefined;
  return { cues, opening };
}

/**
 * Recover a narration script from an already-uploaded SCORM package. This makes
 * parser improvements apply to existing courses without requiring a re-upload.
 */
export async function narrationScriptFromStoredCourse(courseId: number) {
  const assets = await prisma.scormAsset.findMany({
    where: { courseId, mimeType: { startsWith: "text/plain" } },
    select: { path: true },
  });
  const scriptAsset = assets.find((asset) => {
    const base = asset.path.split("/").pop()?.toLowerCase() || "";
    return NARRATION_SCRIPT_NAMES.has(base);
  });
  if (!scriptAsset) return null;
  const content = await readScormAssetContent(courseId, scriptAsset.path);
  return narrationScriptFromPackage([
    { path: scriptAsset.path, content: new Uint8Array(content) },
  ]);
}

export async function importScormZipIntoCourse(courseId: number, zip: Uint8Array) {
  const parsed = parseScormPackage(zip);

  await replaceCourseAssetBlobs(
    courseId,
    parsed.assets.map((asset) => ({
      path: asset.path,
      mimeType: asset.mimeType,
      content: Buffer.from(asset.content),
    })),
  );
  await prisma.masonCourse.update({
    where: { id: courseId },
    data: {
      scormVersion: parsed.version,
      scormEntryPoint: parsed.entryPoint,
    },
  });

  const script = narrationScriptFromPackage(parsed.assets);
  if (script) {
    const section = await prisma.masonSection.findFirst({
      where: { courseId },
      orderBy: { position: "asc" },
      select: { id: true, lessonPlan: true },
    });
    if (section) {
      const plan =
        section.lessonPlan && typeof section.lessonPlan === "object"
          ? (section.lessonPlan as Record<string, unknown>)
          : {};
      await prisma.masonSection.update({
        where: { id: section.id },
        data: {
          lessonPlan: {
            ...plan,
            ...(script.opening ? { opening: script.opening } : {}),
            scormNarration: script.cues,
          } as Prisma.InputJsonValue,
        },
      });
    }
  }

  return parsed;
}

export function scormStagingPrefix(uploadId: string) {
  return `scorm/staging/${uploadId}/`;
}

export async function readStagedScormZip(courseId: number, uploadId: string) {
  const chunks = await readScormAssetsWithPrefix(courseId, scormStagingPrefix(uploadId));
  if (!chunks.length) {
    throw new Error("The uploaded SCORM package could not be found.");
  }
  return Buffer.concat(chunks.map((item) => item.content));
}

export async function deleteStagedScormZip(courseId: number, uploadId: string) {
  await deleteScormAssetsForCourse(courseId, scormStagingPrefix(uploadId));
}
