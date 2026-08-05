export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveClassroomCourse } from "@/lib/classroom-course-lookup";
import { extractResponseOutputText } from "@/lib/parse-response";
import type { ClassroomQuestion } from "@/lib/classroom-question-types";

type SubmittedAnswer = { questionId: string; response: unknown };

function keywordOverlapScore(response: string, reference: string, keyPoints?: string[]) {
  const words = (text: string) =>
    new Set(text.toLowerCase().match(/[a-z0-9]{4,}/g) || []);
  const responseWords = words(response);
  if (!responseWords.size) return false;

  const targetWords = new Set<string>();
  for (const word of words(reference)) targetWords.add(word);
  for (const point of keyPoints || []) for (const word of words(point)) targetWords.add(word);
  if (!targetWords.size) return false;

  const overlap = [...targetWords].filter((word) => responseWords.has(word)).length;
  return overlap / targetWords.size >= 0.35;
}

async function gradeShortAnswerWithAi(prompt: string, sampleAnswer: string, response: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const apiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5.6-sol",
        instructions:
          "You grade a training quiz short-answer response against a reference answer. Be lenient about phrasing — grade for understanding, not exact wording. Return JSON only.",
        text: {
          format: {
            type: "json_schema",
            name: "classroom_short_answer_grade",
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["correct"],
              properties: { correct: { type: "boolean" } },
            },
          },
        },
        input: [
          {
            role: "user",
            content: [
              `Question: ${prompt}`,
              `Reference answer: ${sampleAnswer}`,
              `Learner's answer: ${response}`,
            ].join("\n"),
          },
        ],
      }),
    });
    const data = await apiResponse.json();
    if (!apiResponse.ok) return null;
    const parsed = JSON.parse(extractResponseOutputText(data) || "{}") as { correct?: boolean };
    return typeof parsed.correct === "boolean" ? parsed.correct : null;
  } catch {
    return null;
  }
}

async function gradeAnswer(question: ClassroomQuestion, response: unknown): Promise<boolean> {
  switch (question.type) {
    case "multipleChoice":
      return typeof response === "string" && response === question.correctChoice;
    case "trueFalse":
      return typeof response === "boolean" && response === question.correctAnswer;
    case "dragDrop":
      return (
        Array.isArray(response) &&
        response.length === question.dragItems.length &&
        response.every((item, index) => item === question.dragItems[index])
      );
    case "hotspot": {
      if (!response || typeof response !== "object") return false;
      const { x, y } = response as { x?: number; y?: number };
      if (typeof x !== "number" || typeof y !== "number") return false;
      return Math.hypot(x - question.targetX, y - question.targetY) <= question.toleranceRadius;
    }
    case "flashcard":
      return Boolean((response as { recalled?: boolean } | undefined)?.recalled);
    case "shortAnswer": {
      if (typeof response !== "string" || !response.trim()) return false;
      const aiResult = await gradeShortAnswerWithAi(question.prompt, question.sampleAnswer, response);
      if (aiResult !== null) return aiResult;
      return keywordOverlapScore(response, question.sampleAnswer, question.keyPoints);
    }
    case "scenario": {
      if (question.responseMode === "multipleChoice") {
        return typeof response === "string" && response === question.correctChoice;
      }
      if (typeof response !== "string" || !response.trim()) return false;
      const aiResult = await gradeShortAnswerWithAi(question.prompt, question.sampleAnswer, response);
      if (aiResult !== null) return aiResult;
      return keywordOverlapScore(response, question.sampleAnswer, question.keyPoints);
    }
    default:
      return false;
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      courseSlug?: string;
      studentEmail?: string;
      studentName?: string;
      timeElapsedSeconds?: number;
      answers?: SubmittedAnswer[];
    };

    const courseSlug = String(body.courseSlug || "").trim();
    const studentEmail = String(body.studentEmail || "").trim().toLowerCase();
    const studentName = String(body.studentName || "").trim();
    const answers = Array.isArray(body.answers) ? body.answers : [];

    if (!courseSlug || !studentEmail || !answers.length) {
      return Response.json({ error: "Missing course, student email, or answers." }, { status: 400 });
    }

    const resolved = await resolveClassroomCourse(courseSlug);
    if (!resolved || !resolved.plan.finalTest?.config.enabled) {
      return Response.json({ error: "This course has no final test configured." }, { status: 404 });
    }

    const { courseId, plan } = resolved;
    const finalTest = plan.finalTest!;
    const questionsById = new Map(finalTest.questionBank.map((question) => [question.id, question]));

    let attemptNumber = 1;
    if (courseId !== null && finalTest.config.attemptsAllowed > 0) {
      const priorAttempts = await prisma.classroomAttempt.count({
        where: { courseId, studentEmail },
      });
      attemptNumber = priorAttempts + 1;
      if (attemptNumber > finalTest.config.attemptsAllowed) {
        return Response.json({ error: "No attempts remaining for this final test." }, { status: 403 });
      }
    } else if (courseId !== null) {
      attemptNumber = (await prisma.classroomAttempt.count({ where: { courseId, studentEmail } })) + 1;
    }

    const gradedAnswers = await Promise.all(
      answers.map(async (answer) => {
        const question = questionsById.get(answer.questionId);
        if (!question) return { questionId: answer.questionId, correct: false, response: answer.response };
        const correct = await gradeAnswer(question, answer.response);
        return { questionId: answer.questionId, type: question.type, response: answer.response, correct };
      }),
    );

    const correctCount = gradedAnswers.filter((answer) => answer.correct).length;
    const total = gradedAnswers.length;
    const score = total ? Math.round((correctCount / total) * 100) : 0;
    const passed = score >= finalTest.config.passingScore;

    let certificateId: string | null = null;
    let attemptId: number | null = null;

    if (courseId !== null) {
      if (passed && finalTest.config.certificateOnPass) {
        certificateId = `CT-${courseId}-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 6)}`;
      }

      const attempt = await prisma.classroomAttempt.create({
        data: {
          courseId,
          studentEmail,
          studentName: studentName || null,
          attemptNumber,
          answers: gradedAnswers as unknown as Prisma.InputJsonValue,
          score,
          passed,
          submittedAt: new Date(),
          timeLimitMinutes: finalTest.config.timeLimitMinutes,
          certificateId,
        },
      });
      attemptId = attempt.id;
    }

    return Response.json({
      score,
      passed,
      correctCount,
      total,
      certificateId,
      attemptId,
      attemptNumber,
    });
  } catch (error) {
    console.error("Final test submission failed:", error);
    const message = error instanceof Error ? error.message : "The final test could not be submitted.";
    return Response.json({ error: message }, { status: 500 });
  }
}
