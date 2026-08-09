export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";
import { lessonPlanForChat } from "@/lib/mason-chat";
import { normalizePlayerSettings, type LessonPlan } from "@/lib/mason";

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

    const playerSettings = normalizePlayerSettings(plan.playerSettings);
    if (playerSettings.aiCoach === "off") {
      return Response.json({ error: "The AI instructor is disabled for this course." }, { status: 403 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return Response.json({
        reply:
          "I'm ready to discuss this lesson once the OpenAI API key is connected. You can still continue through the prepared teaching activities.",
      });
    }

    const currentContext = typeof body.currentContext === "string"
      ? body.currentContext.trim().slice(0, 200)
      : "";
    const teachingContent = (plan.moments || [])
      .filter((moment) => moment.phase !== "mastery")
      .map((moment) => [moment.title, moment.narration, moment.prompt].filter(Boolean).join("\n"))
      .join("\n\n")
      .slice(0, 28_000);
    const source = [
      `Section: ${plan.sectionTitle}`,
      currentContext ? `Learner is currently viewing: ${currentContext}` : "",
      `Summary: ${plan.summary}`,
      `Supported facts:\n- ${plan.keyFacts.join("\n- ")}`,
      `Objectives:\n- ${plan.objectives.join("\n- ")}`,
      `Teaching content:\n${teachingContent}`,
    ].filter(Boolean).join("\n\n");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);

    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-5.6-sol",
          reasoning: { effort: "low" },
          max_output_tokens: 700,
          text: { verbosity: "medium" },
          instructions: [
            "You are a warm, direct AI course instructor. Teach clearly, explain the reason, and use one short practical example when useful.",
            "Never reveal, solve, or confirm answers to mastery or final-test questions. You may teach the underlying concept and offer a similar practice example.",
            playerSettings.aiCoach === "guided"
              ? "After answering, ask at most one useful coaching question when it genuinely helps the learner apply the idea."
              : "Answer the learner's question directly. Do not add an unsolicited quiz.",
            playerSettings.knowledgeScope === "course"
              ? "Use only the supplied course source. If it does not establish the answer, say that the course does not cover it."
              : "Lead with the supplied course source. You may add general knowledge only when helpful, clearly label it as outside the course, and never invent company rules, legal requirements, measurements, or procedures.",
          ].join("\n\n"),
          input: [
            { role: "developer", content: source },
            ...messages.map((message) => ({
              role: message.role,
              content: message.content.slice(0, 1000),
            })),
          ],
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error?.message || "The instructor could not respond.");
      }

      return Response.json({ reply: data.output_text || "I could not form an answer from this lesson." });
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    console.error("Instructor chat failed:", error);
    const message =
      error instanceof Error ? error.message : "The instructor could not respond.";
    const timedOut = error instanceof Error && error.name === "AbortError";
    return Response.json(
      { error: timedOut ? "The instructor took too long to respond. Please try again." : message },
      { status: timedOut ? 504 : 500 },
    );
  }
}
