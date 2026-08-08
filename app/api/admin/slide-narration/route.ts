export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

import JSZip from "jszip";
import { requireAdmin } from "@/lib/admin-session";
import { parseSpeed, parseVoice, synthesizeSpeechBuffer } from "@/lib/instructor-speech";
import {
  parseSlideNarrationDocument,
  slideNarrationFileName,
} from "@/lib/slide-narration-batch";

const MAX_SLIDES = 60;

export async function POST(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json();
    const document = String(body.document || "").trim();
    const voice = parseVoice(body.voice);
    const speed = parseSpeed(body.speed);

    if (!document) {
      return Response.json({ error: "Paste your slide narration document first." }, { status: 400 });
    }

    const slides = parseSlideNarrationDocument(document);
    if (!slides.length) {
      return Response.json(
        { error: "No slide narration found. Add Slide 1, Slide 2, ... headings with text under each." },
        { status: 400 },
      );
    }
    if (slides.length > MAX_SLIDES) {
      return Response.json(
        { error: `This tool supports up to ${MAX_SLIDES} slides per batch.` },
        { status: 400 },
      );
    }

    const zip = new JSZip();
    const generated: Array<{ slideNumber: number; fileName: string }> = [];

    for (const slide of slides) {
      const audio = await synthesizeSpeechBuffer(slide.text, voice, speed);
      const fileName = slideNarrationFileName(slide.slideNumber);
      zip.file(fileName, audio);
      generated.push({ slideNumber: slide.slideNumber, fileName });
    }

    const zipBytes = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });

    return new Response(Buffer.from(zipBytes), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="slide-narration.zip"',
        "Cache-Control": "no-store",
        "X-Slide-Count": String(generated.length),
      },
    });
  } catch (error) {
    console.error("Slide narration batch failed:", error);
    const message =
      error instanceof Error ? error.message : "Slide narration could not be generated.";
    return Response.json({ error: message }, { status: 500 });
  }
}
