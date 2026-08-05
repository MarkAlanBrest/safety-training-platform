export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { requireAdmin } from "@/lib/admin-session";
import { MAX_FILE_BYTES, parsePptxBuffer } from "@/lib/ppt-ingest-core";
import { parsePdfBuffer, MAX_PDF_BYTES } from "@/lib/pdf-ingest";
import { generateDraftQuestions } from "@/lib/classroom-question-generator";
import { QUESTION_TYPES, type QuestionType } from "@/lib/classroom-question-types";

function parseIncludeTypes(raw: string | null): QuestionType[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is QuestionType => QUESTION_TYPES.includes(item));
  } catch {
    return [];
  }
}

export async function POST(request: Request) {
  try {
    const unauthorized = await requireAdmin(request);
    if (unauthorized) return unauthorized;

    const form = await request.formData();
    const file = form.get("file");
    const courseTitle = String(form.get("courseTitle") || "").trim();
    const courseDescription = String(form.get("courseDescription") || "").trim();
    const includeTypes = parseIncludeTypes(String(form.get("includeTypes") || "null"));
    const finalTestQuestionCount = Math.max(
      1,
      Math.min(60, Number(form.get("finalTestQuestionCount")) || 20),
    );

    if (!(file instanceof File)) {
      return Response.json({ error: "A .pptx or .pdf file is required." }, { status: 400 });
    }

    const isPptx = /\.pptx$/i.test(file.name);
    const isPdf = /\.pdf$/i.test(file.name);
    if (!isPptx && !isPdf) {
      return Response.json({ error: "Only .pptx and .pdf files are supported." }, { status: 400 });
    }

    const buffer = new Uint8Array(await file.arrayBuffer());
    if (isPptx && buffer.byteLength > MAX_FILE_BYTES) {
      return Response.json({ error: "PowerPoint files are limited to 25 MB." }, { status: 400 });
    }
    if (isPdf && buffer.byteLength > MAX_PDF_BYTES) {
      return Response.json({ error: "PDF files are limited to 25 MB." }, { status: 400 });
    }

    const slides = isPptx ? parsePptxBuffer(buffer) : await parsePdfBuffer(buffer);
    if (!slides.length) {
      return Response.json({ error: "No slide or page content could be read from this file." }, { status: 400 });
    }

    const result = await generateDraftQuestions({
      slides,
      courseTitle: courseTitle || file.name.replace(/\.(pptx|pdf)$/i, ""),
      courseDescription,
      includeTypes,
      finalTestQuestionCount,
    });

    return Response.json(result);
  } catch (error) {
    console.error("Question generation failed:", error);
    const message = error instanceof Error ? error.message : "Questions could not be generated.";
    const status = message.includes("Unauthorized") ? 401 : 500;
    return Response.json({ error: message }, { status });
  }
}
