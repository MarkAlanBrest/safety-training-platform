export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";
import { lessonPlanForChat } from "@/lib/mason-chat";
import type { LessonPlan } from "@/lib/mason";

type ChatMessage = { role: "user" | "assistant"; content: string };

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const sectionId = Number(body.sectionId);
    const sectionIndex = Number(body.sectionIndex);
    const courseSlug =
      typeof body.courseSlug === "string" ? body.courseSlug : undefined;
    const messages = (Array.isArray(body.messages) ? body.messages : [])
      .filter(
        (item: ChatMessage) =>
          (item.role === "user" || item.role === "assistant") &&
          typeof item.content === "string",
      )
      .slice(-10) as ChatMessage[];

    if (!messages.length) {
      return Response.json({ error: "A question is required." }, { status: 400 });
    }

    let plan: LessonPlan | null = lessonPlanForChat({
      courseSlug,
      sectionIndex: Number.isInteger(sectionIndex) ? sectionIndex : undefined,
      sectionId: Number.isInteger(sectionId) ? sectionId : undefined,
    });

    if (!plan && Number.isInteger(sectionId)) {
      const section = await prisma.masonSection.findUnique({
        where: { id: sectionId },
        select: { lessonPlan: true },
      });
      plan = section?.lessonPlan as unknown as LessonPlan | null;
    }

    if (!plan) {
      return Response.json({ error: "Lesson section not found." }, { status: 404 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return Response.json({
        reply:
          "I'm ready to discuss this lesson once the OpenAI API key is connected. You can still continue through the prepared teaching activities.",
      });
    }

    const source = [
      `Section: ${plan.sectionTitle}`,
      `Summary: ${plan.summary}`,
      `Supported facts:\n- ${plan.keyFacts.join("\n- ")}`,
      `Objectives:\n- ${plan.objectives.join("\n- ")}`,
    ].join("\n\n");

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5.6-sol",
        instructions:
          "You are a warm, direct AI course instructor. Answer conversationally using only the supplied lesson source. Teach instead of merely giving an answer: explain the reason, use a short example when useful, and ask at most one helpful follow-up. If the source does not establish an answer, say so clearly.",
        input: [
          { role: "developer", content: source },
          ...messages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        ],
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error?.message || "The instructor could not respond.");
    }

    return Response.json({ reply: data.output_text });
  } catch (error) {
    console.error("Instructor chat failed:", error);
    const message =
      error instanceof Error ? error.message : "The instructor could not respond.";
    return Response.json({ error: message }, { status: 500 });
  }
}
