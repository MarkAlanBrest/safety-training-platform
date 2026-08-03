import type { ClassroomPlan } from "@/lib/classroom";
import { buildClassroomPlanFromSlides, parsePptx } from "@/lib/ppt-ingest";

export async function generateClassroomPlanFromPptx(
  buffer: Uint8Array,
  title: string,
): Promise<ClassroomPlan> {
  const slides = parsePptx(buffer);
  const plan = buildClassroomPlanFromSlides(slides, title);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return plan;

  const slideDigest = slides
    .map(
      (slide) =>
        `Slide ${slide.index + 1}: ${slide.title}\nText: ${slide.bodyText}\nNotes: ${slide.speakerNotes || "(none)"}`,
    )
    .join("\n\n");

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
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
              required: ["opening", "objectives", "topics"],
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
              },
            },
          },
        },
        input: [
          {
            role: "user",
            content: [
              `Course title: ${title}`,
              "Create a warm instructor opening, 3-5 learning objectives, and topic groupings for the left navigation.",
              "Group nearby slides into topics when they clearly belong together.",
              slideDigest,
            ].join("\n\n"),
          },
        ],
      }),
    });

    const data = await response.json();
    if (!response.ok) return plan;

    const parsed = JSON.parse(data.output_text || "{}") as {
      opening?: string;
      objectives?: string[];
      topics?: ClassroomPlan["topics"];
    };

    return {
      ...plan,
      opening: parsed.opening?.trim() || plan.opening,
      objectives: parsed.objectives?.length ? parsed.objectives : plan.objectives,
      topics: parsed.topics?.length ? parsed.topics : plan.topics,
    };
  } catch {
    return plan;
  }
}
