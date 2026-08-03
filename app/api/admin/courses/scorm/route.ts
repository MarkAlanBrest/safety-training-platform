export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/admin-session";
import { isCourseTheme } from "@/lib/course-options";
import { slugify } from "@/lib/mason";
import { prisma } from "@/lib/prisma";
import { parseScormPackage } from "@/lib/scorm";

const MAX_ZIP_BYTES = 4 * 1024 * 1024;

export async function POST(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const form = await request.formData();
    const title = String(form.get("title") || "").trim();
    const description = String(form.get("description") || "").trim();
    const audience = String(form.get("audience") || "").trim();
    const theme = String(form.get("theme") || "heritage");
    const estimatedMinutes = Math.max(10, Math.min(100000, Number(form.get("estimatedMinutes")) || 60));
    const file = form.get("scorm");

    if (!title || !(file instanceof File)) {
      return Response.json({ error: "A course title and SCORM ZIP package are required." }, { status: 400 });
    }
    if (!isCourseTheme(theme)) {
      return Response.json({ error: "Select a valid course theme." }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith(".zip")) {
      return Response.json({ error: "SCORM packages must be uploaded as ZIP files." }, { status: 400 });
    }
    if (file.size > MAX_ZIP_BYTES) {
      return Response.json({ error: "SCORM ZIP uploads are currently limited to 4 MB." }, { status: 400 });
    }

    const parsed = parseScormPackage(new Uint8Array(await file.arrayBuffer()));
    const baseSlug = slugify(title) || "scorm-course";
    let slug = baseSlug;
    let suffix = 2;
    while (await prisma.masonCourse.findUnique({ where: { slug } })) slug = `${baseSlug}-${suffix++}`;

    const course = await prisma.$transaction(async (transaction) => {
      const created = await transaction.masonCourse.create({
        data: {
          title,
          slug,
          description: description || null,
          audience: audience || null,
          theme,
          intensity: "standard",
          estimatedMinutes,
          courseType: "scorm",
          scormVersion: parsed.version,
          scormEntryPoint: parsed.entryPoint,
          published: false,
        },
      });
      await transaction.scormAsset.createMany({
        data: parsed.assets.map((asset) => ({
          courseId: created.id,
          path: asset.path,
          mimeType: asset.mimeType,
          content: Buffer.from(asset.content),
        })),
      });
      return created;
    }, { timeout: 30000 });

    return Response.json({ course, assetCount: parsed.assets.length }, { status: 201 });
  } catch (error) {
    console.error("SCORM course creation failed:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "The SCORM package could not be imported." },
      { status: 400 },
    );
  }
}
