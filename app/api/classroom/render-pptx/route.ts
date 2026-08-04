export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { requireAdmin } from "@/lib/admin-session";
import { MAX_FILE_BYTES, parsePptxBuffer, teachingContentFromParsedSlide } from "@/lib/ppt-ingest-core";
import { renderPptxSlides } from "@/lib/pptx-render-server";

export async function POST(request: Request) {
  try {
    const unauthorized = await requireAdmin(request);
    if (unauthorized) return unauthorized;

    const form = await request.formData();
    const file = form.get("pptx");
    if (!(file instanceof File) || !/\.pptx$/i.test(file.name)) {
      return Response.json({ error: "A .pptx PowerPoint file is required." }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return Response.json({ error: "PowerPoint files are limited to 25 MB." }, { status: 400 });
    }

    const buffer = new Uint8Array(await file.arrayBuffer());
    const parsed = parsePptxBuffer(buffer);
    const images = await renderPptxSlides(buffer, { preset: "preview", format: "jpeg" });

    const slides = parsed.map((slide, index) => {
      const image = images[index];
      if (!image) {
        throw new Error(`Slide ${index + 1} could not be rendered.`);
      }

      return {
        index,
        title: slide.title,
        teachingContent: teachingContentFromParsedSlide(slide),
        imageBase64: Buffer.from(image.bytes).toString("base64"),
        mimeType: image.mimeType,
      };
    });

    return Response.json({
      slideCount: slides.length,
      sourceFileName: file.name,
      slides,
    });
  } catch (error) {
    console.error("PPTX render failed:", error);
    const message =
      error instanceof Error ? error.message : "The PowerPoint could not be rendered.";
    const status = message.includes("Unauthorized") ? 401 : 500;
    return Response.json({ error: message }, { status });
  }
}
