export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { prisma } from "@/lib/prisma";
import { extractResponseOutputText } from "@/lib/parse-response";

const FALLBACK_SUMMARY_PASS =
  "Nice work — you passed the final test. Review any questions you missed to keep the material fresh.";
const FALLBACK_SUMMARY_FAIL =
  "You didn't reach the passing score this time. Review the material and try again when you're ready.";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { attemptId?: number };
    const attemptId = Number(body.attemptId);
    if (!Number.isInteger(attemptId)) {
      return Response.json({ error: "A valid attemptId is required." }, { status: 400 });
    }

    const attempt = await prisma.classroomAttempt.findUnique({ where: { id: attemptId } });
    if (!attempt) {
      return Response.json({ error: "Attempt not found." }, { status: 404 });
    }

    if (attempt.aiReviewSummary) {
      return Response.json({ summary: attempt.aiReviewSummary });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    const fallback = attempt.passed ? FALLBACK_SUMMARY_PASS : FALLBACK_SUMMARY_FAIL;

    if (!apiKey) {
      await prisma.classroomAttempt.update({ where: { id: attemptId }, data: { aiReviewSummary: fallback } });
      return Response.json({ summary: fallback });
    }

    const answers = Array.isArray(attempt.answers) ? attempt.answers : [];
    const missed = answers.filter(
      (answer): answer is { correct?: boolean } => Boolean(answer) && typeof answer === "object",
    ).filter((answer) => answer.correct === false).length;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5.6-sol",
        instructions:
          "You are a supportive safety-training instructor giving brief, personalized feedback after a final test. 2-4 sentences. Return JSON only.",
        text: {
          format: {
            type: "json_schema",
            name: "classroom_final_test_review",
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["summary"],
              properties: { summary: { type: "string" } },
            },
          },
        },
        input: [
          {
            role: "user",
            content: [
              `Score: ${attempt.score}% (${attempt.passed ? "passed" : "did not pass"}).`,
              `Missed ${missed} of ${answers.length} questions.`,
              "Write a short, encouraging summary of how the learner did and what to review, without listing every question.",
            ].join("\n"),
          },
        ],
      }),
    });

    const data = await response.json();
    const summary = response.ok
      ? (JSON.parse(extractResponseOutputText(data) || "{}") as { summary?: string }).summary?.trim() ||
        fallback
      : fallback;

    await prisma.classroomAttempt.update({ where: { id: attemptId }, data: { aiReviewSummary: summary } });
    return Response.json({ summary });
  } catch (error) {
    console.error("Final test AI review failed:", error);
    const message = error instanceof Error ? error.message : "The AI review could not be generated.";
    return Response.json({ error: message }, { status: 500 });
  }
}
