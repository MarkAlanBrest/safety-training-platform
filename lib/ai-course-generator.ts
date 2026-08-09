import type { LessonMoment, LessonPlan } from "@/lib/mason";
import { extractResponseOutputText } from "@/lib/parse-response";

export const AI_COURSE_SOURCE_EXTENSIONS = ["pdf", "docx", "pptx", "txt", "md"] as const;
export const MAX_AI_COURSE_SOURCE_BYTES = 20 * 1024 * 1024;
export const MAX_AI_COURSE_TOTAL_SOURCE_BYTES = 45 * 1024 * 1024;
const AI_GENERATION_TIMEOUT_MS = 120_000;

export type AiCourseSource = {
  name: string;
  mimeType: string;
  bytes: Buffer;
};

export type GeneratedAiCourse = {
  title: string;
  description: string;
  audience: string;
  estimatedMinutes: number;
  theme: "heritage" | "industrial" | "clean" | "field";
  sections: Array<{
    title: string;
    estimatedMinutes: number;
    lessonPlan: LessonPlan;
  }>;
};

const nullableString = { type: ["string", "null"] } as const;
const nullableInteger = { type: ["integer", "null"] } as const;

const momentSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "kind",
    "phase",
    "title",
    "narration",
    "prompt",
    "choices",
    "correctAnswer",
    "feedback",
    "pageNumber",
    "tiles",
    "dragItems",
    "flashcards",
  ],
  properties: {
    kind: {
      type: "string",
      enum: ["explain", "text", "tiles", "dragdrop", "flashcard", "question", "scenario", "summary"],
    },
    phase: { type: "string", enum: ["learn", "activity", "mastery"] },
    title: { type: "string" },
    narration: { type: "string" },
    prompt: nullableString,
    choices: {
      type: ["array", "null"],
      items: { type: "string" },
    },
    correctAnswer: nullableInteger,
    feedback: nullableString,
    pageNumber: nullableInteger,
    tiles: {
      type: ["array", "null"],
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "body"],
        properties: {
          title: { type: "string" },
          body: { type: "string" },
        },
      },
    },
    dragItems: {
      type: ["array", "null"],
      items: { type: "string" },
    },
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
  },
} as const;

const generatedCourseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "description", "audience", "estimatedMinutes", "theme", "sections"],
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    audience: { type: "string" },
    estimatedMinutes: { type: "integer", minimum: 10, maximum: 480 },
    theme: { type: "string", enum: ["heritage", "industrial", "clean", "field"] },
    sections: {
      type: "array",
      minItems: 1,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "estimatedMinutes", "opening", "objectives", "summary", "keyFacts", "moments"],
        properties: {
          title: { type: "string" },
          estimatedMinutes: { type: "integer", minimum: 5, maximum: 120 },
          opening: { type: "string" },
          objectives: {
            type: "array",
            minItems: 2,
            maxItems: 6,
            items: { type: "string" },
          },
          summary: { type: "string" },
          keyFacts: {
            type: "array",
            minItems: 2,
            maxItems: 8,
            items: { type: "string" },
          },
          moments: {
            type: "array",
            minItems: 5,
            maxItems: 18,
            items: momentSchema,
          },
        },
      },
    },
  },
} as const;

function sourceContent(source: AiCourseSource) {
  return {
    type: "input_file" as const,
    filename: source.name,
    file_data: `data:${source.mimeType || "application/octet-stream"};base64,${source.bytes.toString("base64")}`,
  };
}

function normalizedMoment(moment: LessonMoment): LessonMoment {
  const isChoice = moment.kind === "question" || moment.kind === "scenario";
  return {
    ...moment,
    narration: String(moment.narration || "").trim(),
    prompt: isChoice ? String(moment.prompt || "").trim() : moment.prompt,
    choices: isChoice && Array.isArray(moment.choices) ? moment.choices.slice(0, 4) : moment.choices,
    correctAnswer:
      isChoice && Number.isInteger(moment.correctAnswer) ? moment.correctAnswer : null,
  };
}

export async function generateAiCourse(input: {
  brief: string;
  requestedTitle?: string;
  audience?: string;
  estimatedMinutes: number;
  questionCount: number;
  sources: AiCourseSource[];
}): Promise<GeneratedAiCourse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_GENERATION_TIMEOUT_MS);
  const outputBudget = Math.min(28_000, Math.max(12_000, 10_000 + input.estimatedMinutes * 220));

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_COURSE_MODEL || process.env.OPENAI_MODEL || "gpt-5.6-sol",
        reasoning: { effort: "low" },
        instructions: [
          "Role: You are a senior instructional designer, curriculum writer, assessment designer, and digital learning creative director.",
          "Goal: Turn the course brief and supporting files into a polished, accurate, responsive web course that feels intentionally designed rather than generated from a generic template.",
          "Success criteria: Build a coherent chapter sequence; teach concepts in plain language; use concrete examples grounded in the supplied evidence; vary the learning blocks; include coached practice and an independent mastery check; and make every block useful and editable.",
          "Evidence: Treat supporting files as reference material, not as layouts to reproduce. Do not invent regulations, measurements, procedures, product claims, or citations that are not supported by the brief or files. When evidence is incomplete, teach the supported principle without manufacturing specifics.",
          "Design: Use substantial explain/text blocks for depth, tiles for memorable frameworks, dragdrop for true sequences, flashcards for terms or paired concepts, scenarios for judgment, and questions for checks. Avoid repetitive card grids, repeated introductions, filler, slogans, and questions that merely repeat a sentence verbatim.",
          "Assessments: Choices must be plausible complete answers. Put coached questions in activity phase and the requested number of scored questions in mastery phase across the course. Every scored question needs clear corrective feedback.",
          "Output: Return only the strict JSON schema. All learner-facing writing must be publication-ready.",
        ].join("\n\n"),
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: [
                  `Course request: ${input.brief}`,
                  input.requestedTitle ? `Requested title: ${input.requestedTitle}` : "Choose a concise professional title.",
                  input.audience ? `Audience: ${input.audience}` : "Infer a practical audience and state it clearly.",
                  `Target total duration: ${input.estimatedMinutes} minutes.`,
                  `Create approximately ${input.questionCount} mastery questions across the full course.`,
                  "Make the chapter count and content depth fit the requested duration.",
                ].join("\n"),
              },
              ...input.sources.map(sourceContent),
            ],
          },
        ],
        max_output_tokens: outputBudget,
        text: {
          verbosity: "medium",
          format: {
            type: "json_schema",
            name: "native_training_course",
            strict: true,
            schema: generatedCourseSchema,
          },
        },
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error?.message || "AI could not generate the course.");
    }
    const output = extractResponseOutputText(data);
    if (!output) throw new Error("AI returned an empty course draft.");

    const generated = JSON.parse(output) as Omit<GeneratedAiCourse, "sections"> & {
      sections: Array<Omit<GeneratedAiCourse["sections"][number], "lessonPlan"> & Omit<LessonPlan, "sectionTitle">>;
    };
    const sections = generated.sections.map((section) => ({
      title: section.title.trim(),
      estimatedMinutes: section.estimatedMinutes,
      lessonPlan: {
        sectionTitle: section.title.trim(),
        opening: section.opening.trim(),
        objectives: section.objectives.map((item) => item.trim()).filter(Boolean),
        summary: section.summary.trim(),
        keyFacts: section.keyFacts.map((item) => item.trim()).filter(Boolean),
        moments: section.moments.map(normalizedMoment),
      },
    }));

    if (!sections.length || sections.some((section) => !section.title || section.lessonPlan.moments.length < 5)) {
      throw new Error("AI returned an incomplete course draft. Please try generating it again.");
    }

    return {
      title: generated.title.trim() || input.requestedTitle?.trim() || "New training course",
      description: generated.description.trim(),
      audience: generated.audience.trim(),
      estimatedMinutes: generated.estimatedMinutes,
      theme: generated.theme,
      sections,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Course generation took longer than two minutes and was stopped. Try a shorter course or fewer source files.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
