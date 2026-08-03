import type { ClassroomPlan, ClassroomSlide, ClassroomTopic } from "@/lib/classroom";
import type { ClassroomBuilderConfig } from "@/lib/classroom-builder";
import { mergeEnhancedSlide } from "@/lib/classroom-slide-content";
import {
  buildFallbackAssessment,
  buildFallbackCheckpoints,
  buildLessonBeats,
} from "@/lib/classroom-lesson";
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
      "Welcome to class. I will teach from your uploaded slides, ask what you already know, and keep the conversation going like a real instructor.",
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

async function enrichPlanWithAi(
  plan: ClassroomPlan,
  parsedSlides: ParsedClassroomSlide[],
  title: string,
) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return plan;

  const slideDigest = parsedSlides
    .map(
      (slide) =>
        `Slide ${slide.index + 1}: ${slide.title}\nText: ${slide.bodyText}\nNotes: ${slide.speakerNotes || "(none)"}`,
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
          "You are preparing an AI-led classroom lesson from uploaded PowerPoint slides. Return JSON only.",
        text: {
          format: {
            type: "json_schema",
            name: "classroom_plan",
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["opening", "objectives", "topics", "slides"],
              properties: {
                opening: { type: "string" },
                objectives: {
                  type: "array",
                  items: { type: "string" },
                  minItems: 2,
                  maxItems: 6,
                },
                topics: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["id", "title", "slideStart", "slideEnd"],
                    properties: {
                      id: { type: "string" },
                      title: { type: "string" },
                      slideStart: { type: "integer", minimum: 0 },
                      slideEnd: { type: "integer", minimum: 0 },
                    },
                  },
                },
                slides: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: [
                      "index",
                      "title",
                      "subtitle",
                      "bullets",
                      "highlight",
                      "layout",
                    ],
                    properties: {
                      index: { type: "integer", minimum: 0 },
                      title: { type: "string" },
                      subtitle: { type: ["string", "null"] },
                      bullets: {
                        type: "array",
                        items: { type: "string" },
                        minItems: 1,
                        maxItems: 6,
                      },
                      highlight: { type: ["string", "null"] },
                      layout: {
                        type: "string",
                        enum: ["title", "content", "image", "split"],
                      },
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
              "Create a warm instructor opening, 3-5 learning objectives, topic groupings, and polished on-screen slides.",
              "For each slide, write a clear title, short subtitle, 2-5 learner-friendly bullets, one highlight callout, and a layout.",
              "Use layout title for opener slides, split when an image is present, image for photo-heavy slides, content for text slides.",
              "Do not invent facts that are not supported by the source slide text.",
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
      topics?: ClassroomPlan["topics"];
      slides?: Array<{
        index: number;
        title: string;
        subtitle?: string | null;
        bullets: string[];
        highlight?: string | null;
        layout?: ClassroomSlide["layout"];
      }>;
    };

    const enhancedSlides = plan.slides.map((slide) => {
      const enhanced = parsed.slides?.find((item) => item.index === slide.index);
      return mergeEnhancedSlide(slide, {
        title: enhanced?.title,
        subtitle: enhanced?.subtitle || undefined,
        bullets: enhanced?.bullets,
        highlight: enhanced?.highlight || undefined,
        layout: enhanced?.layout,
        bodyText: enhanced?.bullets?.join(" ") || slide.bodyText,
      });
    });

    const enrichedPlan = {
      ...plan,
      opening: parsed.opening?.trim() || plan.opening,
      objectives: parsed.objectives?.length ? parsed.objectives : plan.objectives,
      topics: parsed.topics?.length ? parsed.topics : plan.topics,
      slides: enhancedSlides,
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
  return enrichPlanWithAi(basePlan, parsedSlides, title);
}
