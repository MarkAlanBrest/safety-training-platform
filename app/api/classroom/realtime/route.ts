export const runtime = "nodejs";

import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  classroomPlanForSlug,
  isClassroomPlan,
  type ClassroomPlan,
} from "@/lib/classroom";
import { defaultClassroomBuilderConfig } from "@/lib/classroom-builder";

async function resolvePlan(courseSlug: string): Promise<ClassroomPlan | null> {
  const staticPlan = classroomPlanForSlug(courseSlug);
  if (staticPlan) return staticPlan;

  const course = await prisma.masonCourse.findUnique({
    where: { slug: courseSlug, courseType: "classroom" },
    include: {
      sections: {
        orderBy: { position: "asc" },
        take: 1,
        select: { lessonPlan: true },
      },
    },
  });
  const plan = course?.sections[0]?.lessonPlan;
  return isClassroomPlan(plan) ? plan : null;
}

function teacherInstructions(plan: ClassroomPlan, slideIndex: number) {
  const slide = plan.slides[slideIndex] || plan.slides[0];
  return [
    `You are the live AI instructor for the safety course "${plan.title}".`,
    "Sound warm, attentive, and conversational. Speak in short turns of one to three sentences, then leave room for the learner.",
    "The learner may interrupt you. Stop immediately, listen carefully, answer their actual question, and then return naturally to the lesson.",
    "Do not read the slide word-for-word. Explain it like an experienced instructor and ask only one question at a time.",
    "Never claim that you changed the slide or highlighted something. The presentation controls are handled separately by the classroom.",
    `Current slide ${slide.index + 1} of ${plan.slides.length}: ${slide.title}.`,
    `Visible slide text: ${slide.bodyText || "No extracted text."}`,
    slide.speakerNotes?.trim()
      ? `Private instructor notes: ${slide.speakerNotes}`
      : "There are no private instructor notes for this slide.",
    `Course objectives: ${plan.objectives.join("; ")}`,
  ].join("\n\n");
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: "OPENAI_API_KEY is not configured." },
        { status: 503 },
      );
    }

    const url = new URL(request.url);
    const courseSlug = url.searchParams.get("courseSlug")?.trim();
    const slideIndex = Math.max(0, Number(url.searchParams.get("slideIndex")) || 0);
    if (!courseSlug) {
      return Response.json({ error: "Course is required." }, { status: 400 });
    }

    const plan = await resolvePlan(courseSlug);
    if (!plan) {
      return Response.json({ error: "Classroom lesson not found." }, { status: 404 });
    }

    const offer = await request.text();
    if (!offer.trim()) {
      return Response.json({ error: "WebRTC offer is required." }, { status: 400 });
    }

    const defaults = defaultClassroomBuilderConfig();
    const voice = plan.config?.teaching.voice || defaults.teaching.voice || "cedar";
    const session = {
      type: "realtime",
      model: process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-2.1",
      instructions: teacherInstructions(plan, slideIndex),
      audio: {
        input: {
          transcription: { model: "gpt-4o-mini-transcribe" },
          turn_detection: {
            type: "semantic_vad",
            eagerness: "medium",
            create_response: true,
            interrupt_response: true,
          },
        },
        output: { voice },
      },
    };

    const form = new FormData();
    form.set("sdp", offer);
    form.set("session", JSON.stringify(session));

    const safetyIdentifier = createHash("sha256")
      .update(`classroom:${courseSlug}`)
      .digest("hex");
    const response = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "OpenAI-Safety-Identifier": safetyIdentifier,
      },
      body: form,
    });

    const body = await response.text();
    if (!response.ok) {
      console.error("Realtime classroom session failed:", body);
      return Response.json(
        { error: "The live instructor could not connect." },
        { status: response.status },
      );
    }

    return new Response(body, {
      status: 200,
      headers: { "Content-Type": "application/sdp" },
    });
  } catch (error) {
    console.error("Realtime classroom route failed:", error);
    return Response.json(
      { error: "The live instructor could not connect." },
      { status: 500 },
    );
  }
}
