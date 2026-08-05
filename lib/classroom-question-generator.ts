import type { ParsedClassroomSlide } from "@/lib/ppt-ingest-core";
import { extractResponseOutputText } from "@/lib/parse-response";
import { analyzeSlideForClickTarget } from "@/lib/classroom-hotspots";
import { createLineupId } from "@/lib/classroom-lineup";
import {
  hotspotSlidePlaceholder,
  normalizeAssessmentQuestion,
  normalizeAssessmentQuestions,
  QUESTION_TYPE_LABELS,
  type ClassroomQuestion,
  type GeneratedFormative,
  type QuestionType,
} from "@/lib/classroom-question-types";

const TEXT_QUESTION_TYPES: QuestionType[] = [
  "multipleChoice",
  "trueFalse",
  "dragDrop",
  "flashcard",
  "shortAnswer",
  "scenario",
];

const MAX_HOTSPOT_SLIDES = 6;
const MAX_FORMATIVE_SLIDES = 16;

export type QuestionGenerationRequest = {
  slides: ParsedClassroomSlide[];
  courseTitle: string;
  courseDescription?: string;
  includeTypes: QuestionType[];
  /** Target size of the final test question bank. Defaults to 20. */
  finalTestQuestionCount?: number;
};

export type QuestionGenerationResult = {
  lineupFormatives: GeneratedFormative[];
  finalTestQuestionBank: ClassroomQuestion[];
  warnings: string[];
};

function slideDigest(slides: ParsedClassroomSlide[]) {
  return slides
    .map(
      (slide) =>
        `Slide ${slide.index + 1}: ${slide.title}\nBody text: ${slide.bodyText || "(none)"}\nSpeaker notes: ${slide.speakerNotes || "(none)"}`,
    )
    .join("\n\n");
}

const GENERATED_ITEM_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "type",
    "slideIndex",
    "headline",
    "prompt",
    "explanation",
    "choices",
    "correctChoice",
    "correctAnswer",
    "dragItems",
    "front",
    "back",
    "sampleAnswer",
    "keyPoints",
    "scenarioText",
    "responseMode",
  ],
  properties: {
    type: { type: "string", enum: TEXT_QUESTION_TYPES },
    slideIndex: { type: "integer", minimum: 0 },
    headline: { type: ["string", "null"] },
    prompt: { type: "string" },
    explanation: { type: ["string", "null"] },
    choices: { type: ["array", "null"], items: { type: "string" } },
    correctChoice: { type: ["string", "null"] },
    correctAnswer: { type: ["boolean", "null"] },
    dragItems: { type: ["array", "null"], items: { type: "string" } },
    front: { type: ["string", "null"] },
    back: { type: ["string", "null"] },
    sampleAnswer: { type: ["string", "null"] },
    keyPoints: { type: ["array", "null"], items: { type: "string" } },
    scenarioText: { type: ["string", "null"] },
    responseMode: { type: ["string", "null"], enum: ["multipleChoice", "shortAnswer", null] },
  },
} as const;

async function generateTextQuestionsWithAi(
  slides: ParsedClassroomSlide[],
  textTypes: QuestionType[],
  courseTitle: string,
  courseDescription: string | undefined,
  finalTestQuestionCount: number,
): Promise<{ formatives: unknown[]; bankQuestions: unknown[] } | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !textTypes.length) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5.6-sol",
        instructions:
          "You draft training quiz questions from slide content for an instructor to review, edit, or delete before publishing. Return JSON only. Every question must test understanding of the material — never ask the learner to recall a slide title verbatim.",
        text: {
          format: {
            type: "json_schema",
            name: "classroom_generated_questions",
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["formatives", "bankQuestions"],
              properties: {
                formatives: {
                  type: "array",
                  minItems: 0,
                  maxItems: 40,
                  items: GENERATED_ITEM_SCHEMA,
                },
                bankQuestions: {
                  type: "array",
                  minItems: 0,
                  maxItems: 40,
                  items: GENERATED_ITEM_SCHEMA,
                },
              },
            },
          },
        },
        input: [
          {
            role: "user",
            content: [
              `Course: ${courseTitle}${courseDescription ? ` — ${courseDescription}` : ""}`,
              `Allowed question types: ${textTypes.map((type) => QUESTION_TYPE_LABELS[type]).join(", ")}.`,
              "Produce two sets:",
              "1. `formatives` — one short in-lesson check per slide that has teachable content (use `slideIndex` to say which slide it follows, 0-based).",
              `2. \`bankQuestions\` — a pool of about ${finalTestQuestionCount} questions covering the whole deck for a final test (slideIndex can be the most relevant slide, still 0-based).`,
              "Vary the question types across the allowed list rather than using only one type.",
              "For trueFalse, set `correctAnswer` (boolean). For dragDrop, set `dragItems` in correct order (3-5 items). For flashcard, set `front`/`back`. For shortAnswer, set `sampleAnswer` and optionally `keyPoints`. For scenario, set `scenarioText` plus either `choices`/`correctChoice` (responseMode multipleChoice) or `sampleAnswer`/`keyPoints` (responseMode shortAnswer). For multipleChoice, every choice must be a complete answer statement, never a slide title or heading.",
              "Leave fields null when they don't apply to that question's type.",
              slideDigest(slides),
            ].join("\n\n"),
          },
        ],
      }),
    });

    const data = await response.json();
    if (!response.ok) return null;

    const parsed = JSON.parse(extractResponseOutputText(data) || "{}") as {
      formatives?: unknown[];
      bankQuestions?: unknown[];
    };
    return { formatives: parsed.formatives || [], bankQuestions: parsed.bankQuestions || [] };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function fallbackChoicesForSlide(slide: ParsedClassroomSlide): string[] {
  const snippet =
    slide.bullets[0] ||
    slide.bodyText.split(/(?:\n|(?<=[.!?])\s+)/).find((part) => part.trim().length > 12) ||
    slide.title;
  return [snippet.trim().slice(0, 160), "None of the above", "I'm not sure yet", "The opposite is true"];
}

function fallbackDragItems(slide: ParsedClassroomSlide): string[] {
  const items = slide.bullets.filter((bullet) => bullet.trim().length > 4).slice(0, 5);
  return items.length >= 2 ? items : [slide.title, "Review this step", "Confirm with your instructor"];
}

function fallbackQuestionForType(
  type: QuestionType,
  slide: ParsedClassroomSlide,
  index: number,
): ClassroomQuestion | null {
  const id = createLineupId("question");
  switch (type) {
    case "multipleChoice": {
      const choices = fallbackChoicesForSlide(slide);
      return { id, type, prompt: `Which statement best matches "${slide.title}"?`, choices, correctChoice: choices[0] };
    }
    case "trueFalse":
      return {
        id,
        type,
        prompt: `True or false: ${slide.bullets[0] || slide.bodyText.slice(0, 140) || slide.title}`,
        correctAnswer: index % 2 === 0,
      };
    case "dragDrop":
      return { id, type, prompt: `Put these steps from "${slide.title}" in the correct order.`, dragItems: fallbackDragItems(slide) };
    case "flashcard":
      return {
        id,
        type,
        prompt: `Flip the card for "${slide.title}".`,
        front: slide.title,
        back: (slide.bullets[0] || slide.bodyText).slice(0, 180) || "Key idea from this slide.",
      };
    case "shortAnswer":
      return {
        id,
        type,
        prompt: `In your own words, explain the key point of "${slide.title}".`,
        sampleAnswer: slide.bullets[0] || slide.bodyText.slice(0, 200) || slide.title,
      };
    case "scenario":
      return {
        id,
        type,
        scenarioText: slide.speakerNotes || slide.bodyText.slice(0, 220) || slide.title,
        prompt: "What should you do in this situation?",
        responseMode: "shortAnswer",
        sampleAnswer: slide.bullets[0] || slide.title,
      };
    default:
      return null;
  }
}

function buildFallbackQuestions(
  slides: ParsedClassroomSlide[],
  types: QuestionType[],
  count: number,
): ClassroomQuestion[] {
  if (!slides.length || !types.length) return [];
  const questions: ClassroomQuestion[] = [];
  for (let i = 0; i < count; i += 1) {
    const slide = slides[i % slides.length];
    const type = types[i % types.length];
    const question = fallbackQuestionForType(type, slide, i);
    if (question) questions.push(question);
  }
  return questions;
}

async function generateHotspotTargets(
  slides: ParsedClassroomSlide[],
): Promise<Array<{ slideIndex: number; question: ClassroomQuestion }>> {
  const candidates = slides.filter((slide) => slide.image).slice(0, MAX_HOTSPOT_SLIDES);
  const results = await Promise.all(
    candidates.map(async (slide) => {
      const target = await analyzeSlideForClickTarget({
        title: slide.title,
        bodyText: slide.bodyText,
        speakerNotes: slide.speakerNotes,
        image: slide.image,
      });
      if (!target) return null;
      const result: { slideIndex: number; question: ClassroomQuestion } = {
        slideIndex: slide.index,
        question: {
          id: createLineupId("question"),
          type: "hotspot",
          prompt: `Click on ${target.label.toLowerCase().startsWith("the") ? target.label : `the ${target.label.toLowerCase()}`} in this image.`,
          explanation: target.description,
          imageUrl: hotspotSlidePlaceholder(slide.index),
          targetX: target.targetX,
          targetY: target.targetY,
          toleranceRadius: target.toleranceRadius,
        },
      };
      return result;
    }),
  );
  return results.filter((item): item is { slideIndex: number; question: ClassroomQuestion } => Boolean(item));
}

export async function generateDraftQuestions(
  req: QuestionGenerationRequest,
): Promise<QuestionGenerationResult> {
  const warnings: string[] = [];
  const includeTypes = req.includeTypes.length ? req.includeTypes : TEXT_QUESTION_TYPES;
  const textTypes = includeTypes.filter((type): type is QuestionType => TEXT_QUESTION_TYPES.includes(type));
  const wantsHotspot = includeTypes.includes("hotspot");
  const finalTestQuestionCount = req.finalTestQuestionCount || 20;
  const formativeSlides = req.slides.slice(0, MAX_FORMATIVE_SLIDES);

  const lineupFormatives: GeneratedFormative[] = [];
  const finalTestQuestionBank: ClassroomQuestion[] = [];

  const aiResult = textTypes.length
    ? await generateTextQuestionsWithAi(
        req.slides,
        textTypes,
        req.courseTitle,
        req.courseDescription,
        finalTestQuestionCount,
      )
    : null;

  if (aiResult) {
    for (const raw of aiResult.formatives) {
      const question = normalizeAssessmentQuestion(raw);
      if (!question || !textTypes.includes(question.type)) continue;
      const rawObj = raw as Record<string, unknown>;
      const headline =
        typeof rawObj.headline === "string" && rawObj.headline.trim()
          ? rawObj.headline.trim()
          : "Check your understanding";
      const slideIndex = req.slides.length
        ? Math.min(Math.max(0, Math.round(Number(rawObj.slideIndex) || 0)), req.slides.length - 1)
        : 0;
      lineupFormatives.push({ slideIndex, headline, question });
    }

    finalTestQuestionBank.push(
      ...normalizeAssessmentQuestions(aiResult.bankQuestions).filter((question) =>
        textTypes.includes(question.type),
      ),
    );
  } else if (textTypes.length) {
    warnings.push(
      process.env.OPENAI_API_KEY
        ? "AI generation failed — showing placeholder drafts instead. Edit before publishing."
        : "No OPENAI_API_KEY configured — showing placeholder drafts instead of AI-generated questions.",
    );
    formativeSlides.forEach((slide, index) => {
      const type = textTypes[index % textTypes.length];
      const question = fallbackQuestionForType(type, slide, index);
      if (question) {
        lineupFormatives.push({
          slideIndex: slide.index,
          headline: "Check your understanding",
          question,
        });
      }
    });
    finalTestQuestionBank.push(...buildFallbackQuestions(req.slides, textTypes, finalTestQuestionCount));
  }

  if (wantsHotspot) {
    const hotspotResults = await generateHotspotTargets(req.slides);
    if (!hotspotResults.length) {
      warnings.push("No click-the-spot questions were generated — slides need embedded images for this type.");
    }
    for (const { slideIndex, question } of hotspotResults) {
      lineupFormatives.push({ slideIndex, headline: "Click the correct spot", question });
      finalTestQuestionBank.push(question);
    }
  }

  return { lineupFormatives, finalTestQuestionBank, warnings };
}
