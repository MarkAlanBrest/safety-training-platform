import type { ClassroomPlan, ClassroomSlide, ClassroomTopic } from "@/lib/classroom";
import type { ClassroomBuilderConfig } from "@/lib/classroom-builder";
import {
  buildFallbackAssessment,
  buildFallbackCheckpoints,
  buildLessonBeats,
} from "@/lib/classroom-lesson";
import type { ClassroomCheckpoint, ClassroomAssessmentQuestion } from "@/lib/classroom-lesson";
import type { ParsedClassroomSlide } from "@/lib/ppt-ingest";
import { extractResponseOutputText } from "@/lib/parse-response";

export function buildClassroomPlanFromSlides(
  slides: ClassroomSlide[],
  title: string,
  config?: ClassroomBuilderConfig,
): ClassroomPlan {
  const topics: ClassroomTopic[] = slides.map((slide, index) => ({
    id: `topic-${index + 1}`,
    title: slide.title,
    slideStart: index,
    slideEnd: index,
  }));

  const objectives =
    config?.knowledge.objectives.filter(Boolean) ||
    slides
      .map((slide) => slide.title)
      .filter(Boolean)
      .slice(0, 5);

  const checkpoints = buildFallbackCheckpoints(slides, config);
  const assessment = buildFallbackAssessment(slides, config);
  const plan: ClassroomPlan = {
    type: "classroom",
    title: config?.knowledge.courseName || title,
    opening:
      config?.knowledge.description ||
      "Welcome to class. I'll teach from your PowerPoint slides, explain the ideas in my own words, and weave in quick activities to check understanding.",
    objectives: objectives.length ? objectives : ["Understand the lesson material"],
    topics,
    slides,
    checkpoints,
    assessment,
    config,
  };
  plan.lessonBeats = buildLessonBeats(plan);
  return plan;
}

async function enrichTeachingActivitiesWithAi(
  plan: ClassroomPlan,
  parsedSlides: ParsedClassroomSlide[],
  title: string,
) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return plan;

  const slideDigest = parsedSlides
    .map(
      (slide) =>
        `Slide ${slide.index + 1}: ${slide.title}\nOn-slide text: ${slide.bodyText}\nSpeaker notes: ${slide.speakerNotes || "(none)"}`,
    )
    .join("\n\n");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

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
          "You prepare AI teaching activities for a classroom that displays PowerPoint slides unchanged. Return JSON only. Do not rewrite slide titles or bullets.",
        text: {
          format: {
            type: "json_schema",
            name: "classroom_teaching_plan",
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["opening", "objectives", "checkpoints", "assessment"],
              properties: {
                opening: { type: "string" },
                objectives: {
                  type: "array",
                  items: { type: "string" },
                  minItems: 2,
                  maxItems: 6,
                },
                checkpoints: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: [
                      "id",
                      "slideIndex",
                      "type",
                      "headline",
                      "prompt",
                      "choices",
                      "correctChoice",
                      "flashcards",
                      "dragItems",
                    ],
                    properties: {
                      id: { type: "string" },
                      slideIndex: { type: "integer", minimum: 0 },
                      type: {
                        type: "string",
                        enum: [
                          "question",
                          "exercise",
                          "multipleChoice",
                          "flashcard",
                          "dragdrop",
                        ],
                      },
                      headline: { type: "string" },
                      prompt: { type: "string" },
                      choices: {
                        type: ["array", "null"],
                        items: { type: "string" },
                      },
                      correctChoice: { type: ["string", "null"] },
                      flashcards: {
                        type: ["array", "null"],
                        items: {
                          type: "object",
                          additionalProperties: false,
                          required: ["front", "back"],
                          properties: {
                            front: { type: "string" },
                            back: { type: "string" },
                          },
                        },
                      },
                      dragItems: {
                        type: ["array", "null"],
                        items: { type: "string" },
                      },
                    },
                  },
                },
                assessment: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["id", "prompt", "choices", "correctChoice"],
                    properties: {
                      id: { type: "string" },
                      prompt: { type: "string" },
                      choices: {
                        type: "array",
                        items: { type: "string" },
                        minItems: 3,
                        maxItems: 4,
                      },
                      correctChoice: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
        input: [
          {
            role: "user",
            content: [
              `Course title: ${title}`,
              "Create a warm instructor opening and 3-5 learning objectives.",
              "Add short interactive checkpoints after key slides and a final assessment.",
              "Mix checkpoint types: multiple choice, flash cards, and drag-and-drop sequencing.",
              "For flashcard checkpoints use type flashcard with 2-4 cards. For drag-and-drop use type dragdrop with 3-5 ordered items.",
              "Checkpoints should test understanding — do not ask learners to read slide text back verbatim.",
              "Use slideIndex to place each checkpoint after the relevant slide.",
              slideDigest,
            ].join("\n\n"),
          },
        ],
      }),
    });

    const data = await response.json();
    if (!response.ok) return plan;

    const parsed = JSON.parse(extractResponseOutputText(data) || "{}") as {
      opening?: string;
      objectives?: string[];
      checkpoints?: ClassroomCheckpoint[];
      assessment?: ClassroomAssessmentQuestion[];
    };

    const enrichedPlan = {
      ...plan,
      opening: parsed.opening?.trim() || plan.opening,
      objectives: parsed.objectives?.length ? parsed.objectives : plan.objectives,
      checkpoints: parsed.checkpoints?.length ? parsed.checkpoints : plan.checkpoints,
      assessment: parsed.assessment?.length ? parsed.assessment : plan.assessment,
    };
    enrichedPlan.lessonBeats = buildLessonBeats(enrichedPlan);
    return enrichedPlan;
  } catch {
    return plan;
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateClassroomPlan(
  parsedSlides: ParsedClassroomSlide[],
  slides: ClassroomSlide[],
  title: string,
  config?: ClassroomBuilderConfig,
): Promise<ClassroomPlan> {
  const basePlan = buildClassroomPlanFromSlides(slides, title, config);
  return enrichTeachingActivitiesWithAi(basePlan, parsedSlides, title);
}
