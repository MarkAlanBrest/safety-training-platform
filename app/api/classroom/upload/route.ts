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
import { classroomChapterDeckAssetPath, classroomChapterSlideAssetPath } from "@/lib/classroom-chapters";
import { renderSlideAsset } from "@/lib/ppt-slide-render";
import {
  MAX_FILE_BYTES,
  parsePptx,
  parsedChaptersFromUploadFormAsync,
  slidesForClassroomPlan,
} from "@/lib/ppt-ingest";
import { slugify } from "@/lib/mason";
import {
  extractSlideImagesFromZip,
  MAX_SLIDE_IMAGE_ZIP_BYTES,
} from "@/lib/ppt-slide-images";

const MAX_LEGACY_UPLOAD_BYTES = 4 * 1024 * 1024;

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
    const stagedAssets = String(form.get("stagedAssets") || "false") === "true";
    const config = parseBuilderConfig(String(form.get("config") || ""));
    const sourceFileName = String(form.get("sourceFileName") || "classroom.pptx");
    const file = form.get("pptx");
    const hasPreparedSlides = Boolean(form.get("slides") || form.get("chapters"));

    if (!title) {
      return Response.json({ error: "A course title is required." }, { status: 400 });
    }

    const mergedConfig = defaultClassroomBuilderConfig({
      ...config,
      knowledge: {
        ...config.knowledge,
        courseName: title,
        description: description || config.knowledge.description,
      },
    });

    let chapters: Array<{ title: string; slides: Awaited<ReturnType<typeof parsePptx>> }>;
    let fileName = sourceFileName;
    const deckFiles: Array<{ chapterPosition: number; bytes: Uint8Array }> = [];

    if (hasPreparedSlides) {
      chapters = await parsedChaptersFromUploadFormAsync(form);
      if (!chapters.length || !chapters[0].slides.length) {
        return Response.json({ error: "No slides were found in this upload." }, { status: 400 });
      }
      for (let chapterIndex = 0; chapterIndex < chapters.length; chapterIndex += 1) {
        if (stagedAssets) continue;

        const key = chapterIndex === 0 ? "pptx" : `chapter-${chapterIndex}-pptx`;
        const deckFile = form.get(key);
        if (!(deckFile instanceof File) || !/\.pptx$/i.test(deckFile.name)) {
          return Response.json(
            { error: `A PowerPoint source file is required for chapter ${chapterIndex + 1}.` },
            { status: 400 },
          );
        }
        if (deckFile.size > MAX_FILE_BYTES) {
          return Response.json(
            { error: "PowerPoint files are limited to 25 MB." },
            { status: 400 },
          );
        }
        deckFiles.push({
          chapterPosition: chapterIndex + 1,
          bytes: new Uint8Array(await deckFile.arrayBuffer()),
        });

        const zipKey =
          chapterIndex === 0
            ? "slideImagesZip"
            : `chapter-${chapterIndex}-slideImagesZip`;
        const imageZip = form.get(zipKey);
        if (!(imageZip instanceof File) || !/\.zip$/i.test(imageZip.name)) {
          return Response.json(
            { error: `An exported slide-image ZIP is required for chapter ${chapterIndex + 1}.` },
            { status: 400 },
          );
        }
        if (imageZip.size > MAX_SLIDE_IMAGE_ZIP_BYTES) {
          return Response.json(
            { error: "Slide-image ZIP files are limited to 75 MB." },
            { status: 400 },
          );
        }
        const exactImages = extractSlideImagesFromZip(
          new Uint8Array(await imageZip.arrayBuffer()),
          chapters[chapterIndex].slides.length,
        );
        chapters[chapterIndex].slides = chapters[chapterIndex].slides.map((slide, index) => ({
          ...slide,
          images: [],
          image: null,
          renderedSlide: exactImages[index],
        }));
      }
    } else {
      if (!(file instanceof File)) {
        return Response.json({ error: "A PowerPoint file is required." }, { status: 400 });
      }
      if (!/\.pptx$/i.test(file.name)) {
        return Response.json(
          { error: "Only .pptx PowerPoint files are supported right now." },
          { status: 400 },
        );
      }
      if (file.size > MAX_LEGACY_UPLOAD_BYTES) {
        return Response.json(
          {
            error:
              "This file is too large for direct upload. Please refresh the page and try again — your browser should prepare the deck automatically.",
          },
          { status: 400 },
        );
      }
      fileName = file.name;
      const buffer = new Uint8Array(await file.arrayBuffer());
      chapters = [{ title: title, slides: parsePptx(buffer) }];
      deckFiles.push({ chapterPosition: 1, bytes: buffer });
    }

    let slug = slugify(title);
    const existing = await prisma.masonCourse.findUnique({ where: { slug } });
    if (existing) slug = `${slug}-${Date.now().toString(36)}`;

    const sectionPlans: Array<{
      title: string;
      position: number;
      fileName: string;
      plan: Awaited<ReturnType<typeof generateClassroomPlan>>;
      parsedSlides: (typeof chapters)[number]["slides"];
      chapterPosition: number;
    }> = [];
    let totalSlides = 0;
    for (let chapterIndex = 0; chapterIndex < chapters.length; chapterIndex += 1) {
      const chapter = chapters[chapterIndex];
      const chapterPosition = chapterIndex + 1;
      const slides = slidesForClassroomPlan(chapter.slides, slug, { chapterPosition });
      const plan = await generateClassroomPlan(
        chapter.slides,
        slides,
        chapter.title || title,
        mergedConfig,
      );
      sectionPlans.push({
        title: chapter.title || `Chapter ${chapterPosition}`,
        position: chapterPosition,
        fileName: chapterIndex === 0 ? fileName : `${chapter.title || "chapter"}.pptx`,
        plan,
        parsedSlides: chapter.slides,
        chapterPosition,
      });
      totalSlides += plan.slides.length;
    }

    const estimates = estimateClassroomCourse(totalSlides, mergedConfig);

    const course = await prisma.$transaction(async (tx) => {
      const created = await tx.masonCourse.create({
        data: {
          title,
          slug,
          description:
            description ||
            mergedConfig.knowledge.description ||
            `AI classroom lesson built from ${fileName}`,
          courseType: "classroom",
          displayMode: "classroom",
          published: stagedAssets ? false : published,
          estimatedMinutes: estimates.courseLengthMinutes,
          intensity:
            mergedConfig.knowledge.difficulty === "beginner"
              ? "essentials"
              : mergedConfig.knowledge.difficulty === "advanced"
                ? "comprehensive"
                : "standard",
          sections: {
            create: sectionPlans.map((section) => ({
              title: section.title,
              position: section.position,
              estimatedMinutes: estimates.courseLengthMinutes,
              fileName: section.fileName,
              lessonPlan: section.plan,
            })),
          },
        },
        select: { id: true, title: true, slug: true, published: true },
      });

      const assets = [];
      if (!stagedAssets) {
        for (const section of sectionPlans) {
          for (const slide of section.parsedSlides) {
            const rendered = await renderSlideAsset(slide);
            assets.push({
              courseId: created.id,
              path: classroomChapterSlideAssetPath(section.chapterPosition, slide.index),
              mimeType: rendered.mimeType,
              content: Buffer.from(rendered.bytes),
            });
          }
        }
      }

      for (const deck of deckFiles) {
        assets.push({
          courseId: created.id,
          path: classroomChapterDeckAssetPath(deck.chapterPosition),
          mimeType:
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          content: Buffer.from(deck.bytes),
        });
      }

      if (assets.length) {
        await tx.scormAsset.createMany({ data: assets });
      }

      return created;
    });

    return Response.json({
      course,
      slideCount: totalSlides,
      chapterCount: sectionPlans.length,
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
