import type { LessonMoment, LessonPlan } from "@/lib/mason";
import { extractResponseOutputText } from "@/lib/parse-response";

export const AI_COURSE_SOURCE_EXTENSIONS = ["pdf", "docx", "pptx", "txt", "md"] as const;
export const MAX_AI_COURSE_SOURCE_BYTES = 20 * 1024 * 1024;
export const MAX_AI_COURSE_TOTAL_SOURCE_BYTES = 45 * 1024 * 1024;
const AI_REQUEST_TIMEOUT_MS = 25_000;

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
    "sourceName",
    "imagePrompt",
    "imageAlt",
    "tiles",
    "dragItems",
    "flashcards",
  ],
  properties: {
    kind: {
      type: "string",
      enum: ["explain", "text", "tiles", "dragdrop", "visual", "flashcard", "question", "scenario", "summary"],
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
    sourceName: nullableString,
    imagePrompt: nullableString,
    imageAlt: nullableString,
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
  const generated = moment as LessonMoment & { imageAlt?: string | null };
  if (moment.kind === "visual") {
    const narration = String(moment.narration || "").trim();
    return {
      ...moment,
      narration: "",
      prompt: null,
      choices: null,
      correctAnswer: null,
      feedback: null,
      sourceImageAlt: String(generated.imageAlt || moment.title || "Course photograph").trim(),
      explainerStyle: "flipbook",
      explainerFrames: [
        {
          title: moment.title,
          caption: String(generated.imageAlt || "").trim(),
          narration,
          visualItems: [],
          sourceImage: null,
        },
      ],
    };
  }
  return {
    ...moment,
    narration: String(moment.narration || "").trim(),
    prompt: isChoice ? String(moment.prompt || "").trim() : moment.prompt,
    choices: isChoice && Array.isArray(moment.choices) ? moment.choices.slice(0, 4) : moment.choices,
    correctAnswer:
      isChoice && Number.isInteger(moment.correctAnswer) ? moment.correctAnswer : null,
  };
}

export type AiCourseGenerationInput = {
  brief: string;
  requestedTitle?: string;
  audience?: string;
  estimatedMinutes: number;
  questionCount: number;
  displayMode: "webpage" | "slideshow";
  pictureMode: "source" | "ai" | "none";
  requestedTheme?: string;
  sources: AiCourseSource[];
};

type AiResponseData = {
  id?: string;
  status?: string;
  output_text?: string;
  output?: Array<{ content?: Array<{ text?: string }> }>;
  error?: { message?: string } | null;
  incomplete_details?: { reason?: string } | null;
};

type PowerPointSlideReference = {
  sourceName: string;
  slideNumber: number;
};

function powerPointRoadmap(sources: AiCourseSource[]): PowerPointSlideReference[] {
  return sources.flatMap((source) => {
    if (!source.name.toLowerCase().endsWith("-powerpoint-content.txt")) return [];
    const content = source.bytes.toString("utf8");
    const sourceName = content.match(/^PowerPoint source:\s*(.+)$/m)?.[1]?.trim();
    if (!sourceName) return [];
    return [...content.matchAll(/^--- Slide (\d+) ---$/gm)].map((match) => ({
      sourceName,
      slideNumber: Number(match[1]),
    }));
  });
}

function normalizedSourceName(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function assertPowerPointCoverage(course: GeneratedAiCourse, sources: AiCourseSource[]) {
  const roadmap = powerPointRoadmap(sources);
  if (!roadmap.length) return;
  const expected = roadmap.map(
    (slide) => `${normalizedSourceName(slide.sourceName)}:${slide.slideNumber}`,
  );
  const actual = course.sections.flatMap((section) =>
    section.lessonPlan.moments
      .filter((moment) => moment.phase === "learn" && moment.pageNumber && moment.sourceName)
      .map((moment) => `${normalizedSourceName(moment.sourceName)}:${moment.pageNumber}`),
  );
  const represented = new Set(actual);
  const missing = roadmap.filter(
    (slide) => !represented.has(`${normalizedSourceName(slide.sourceName)}:${slide.slideNumber}`),
  );
  if (missing.length) {
    const sample = missing
      .slice(0, 6)
      .map((slide) => `${slide.sourceName} slide ${slide.slideNumber}`)
      .join(", ");
    throw new Error(
      `The AI draft skipped ${missing.length} PowerPoint slide${missing.length === 1 ? "" : "s"} (${sample}${missing.length > 6 ? ", …" : ""}). Generate again so every source slide is retained.`,
    );
  }
  if (actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
    throw new Error(
      "The AI draft changed the PowerPoint slide order or created duplicate source-slide lessons. Generate again so the online course follows the deck exactly.",
    );
  }
}

function requestBody(input: AiCourseGenerationInput) {
  const roadmap = powerPointRoadmap(input.sources);
  const outputBudget = Math.min(
    36_000,
    Math.max(12_000, 10_000 + input.estimatedMinutes * 220, roadmap.length * 350),
  );
  return {
    model: process.env.OPENAI_COURSE_MODEL || process.env.OPENAI_MODEL || "gpt-5.6-sol",
    background: true,
    reasoning: { effort: "low" },
    instructions: [
      "Role: You are a senior instructional designer, curriculum writer, assessment designer, and digital learning creative director.",
      "Goal: Turn the course brief and supporting files into a polished, accurate, responsive web course that feels intentionally designed rather than generated from a generic template.",
      "Success criteria: Build a coherent chapter sequence; teach concepts in plain language; use concrete examples grounded in the supplied evidence; vary the learning blocks; include coached practice and an independent mastery check; and make every block useful and editable.",
      "Evidence: Treat supporting files as reference material, not as layouts to reproduce. Do not invent regulations, measurements, procedures, product claims, or citations that are not supported by the brief or files. When evidence is incomplete, teach the supported principle without manufacturing specifics.",
      roadmap.length
        ? [
            `PowerPoint roadmap: The supplied PowerPoint material contains ${roadmap.length} source slides. Convert every original slide into exactly one primary learning moment, preserve the original deck and slide order, and retain every instructional fact, example, warning, and intended idea from that slide. Redesign the material for a polished online course; do not merely copy its layout.`,
            "For every primary source-slide moment, set phase to learn, pageNumber to the exact original slide number, and sourceName to the exact value shown after 'PowerPoint source:'. A slide with embedded pictures must use kind visual so its original pictures can be attached. A text-only slide may use explain, text, tiles, flashcard, summary, or another suitable teaching block.",
            "Do not merge source slides, omit title or recap slides, reorder them, or replace them with newly invented content. Divide long decks into contiguous sections while maintaining global deck order. Insert useful questions, scenarios, or practice immediately after the source slide they reinforce; added interactions may share that slide's pageNumber and sourceName but must use activity or mastery phase and must not replace its learn moment.",
            "Keep each redesigned source-slide moment focused: normally 60–160 learner-facing words, expanding only when its source content requires more explanation. Speaker notes are teaching guidance and must influence the corresponding moment.",
          ].join(" ")
        : "Source structure: Organize supporting material into the clearest instructional sequence for the requested audience.",
      "Instructional depth: Each section must have a purposeful arc: a motivating opening, clear explanation, a concrete worked example, active practice, a realistic decision or scenario, and a useful recap. Teach why and how, not merely definitions. Use source-specific facts and workplace examples whenever the evidence supports them.",
      "Design: Use explain/text blocks for real teaching depth, tiles only for memorable frameworks, dragdrop only for true sequences, flashcards for terms or paired concepts, scenarios for judgment, and questions for checks. Avoid repetitive card grids, repeated introductions, filler, slogans, vague advice, and questions that merely repeat a sentence verbatim.",
      input.pictureMode !== "none"
        ? [
            "Pictures: Include exactly one visual moment in each section. It must depict a concrete, instructionally useful real-world scene that reinforces the surrounding lesson. Supply a detailed imagePrompt for a realistic professional training photograph and concise imageAlt text. Do not request text, labels, logos, brand marks, graphic injuries, or a generic decorative scene. All non-visual moments must use null for imagePrompt and imageAlt.",
            input.pictureMode === "source"
              ? "For each PowerPoint slide that has embedded pictures, use a visual moment with that slide's exact pageNumber and sourceName so all meaningful original pictures can be reused as a multi-frame explainer. Ignore logos, backgrounds, icons, and decorative graphics."
              : "Set pageNumber to null; pictures will be newly generated.",
          ].join(" ")
        : "Pictures: Do not create visual moments. Set imagePrompt and imageAlt to null for every moment.",
      "Quality control: Every moment must add new instructional value. Do not write generic safety language that could fit any course. Include consequences, common errors, observable cues, and practical decisions appropriate to the stated audience. Ensure every objective is actually taught and assessed.",
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
              roadmap.length
                ? input.displayMode === "slideshow"
                  ? "Format: Slide presentation. Each original PowerPoint slide becomes one redesigned online slide, generally 60-140 learner-facing words, with interactions inserted as additional slides."
                  : "Format: Scrolling editorial webpage. Each original PowerPoint slide becomes one clearly separated redesigned learning block, generally 60-160 learner-facing words, with interactions placed between source-slide blocks."
                : input.displayMode === "slideshow"
                  ? "Format: Slide presentation. Make each moment focused enough to fit one screen, generally 60-140 spoken words, while using enough moments to teach the subject thoroughly."
                  : "Format: Scrolling editorial webpage. Write substantial explain/text moments, generally 180-320 words with short paragraphs, and place activities naturally between reading sections.",
              input.requestedTheme
                ? `Required visual theme: ${input.requestedTheme}.`
                : "Choose the visual theme that best suits the subject and audience.",
              roadmap.length
                ? "Preserving every PowerPoint slide takes priority over the requested duration; use contiguous chapters to make the complete roadmap easy to navigate."
                : "Make the chapter count and content depth fit the requested duration.",
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
  };
}

function parseGeneratedCourse(
  data: AiResponseData,
  input: Pick<AiCourseGenerationInput, "requestedTitle" | "sources">,
): GeneratedAiCourse {
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

  const course = {
    title: generated.title.trim() || input.requestedTitle?.trim() || "New training course",
    description: generated.description.trim(),
    audience: generated.audience.trim(),
    estimatedMinutes: generated.estimatedMinutes,
    theme: generated.theme,
    sections,
  };
  assertPowerPointCoverage(course, input.sources);
  return course;
}

async function openAiRequest(url: string, init?: RequestInit, timeoutMs = AI_REQUEST_TIMEOUT_MS) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });
    const data = (await response.json()) as AiResponseData;
    if (!response.ok) {
      throw new Error(data?.error?.message || "AI could not generate the course.");
    }
    return data;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("The AI service did not respond to the request in time. If the background job already started, checking again will recover it.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function startAiCourseGeneration(input: AiCourseGenerationInput) {
  const data = await openAiRequest("https://api.openai.com/v1/responses", {
    method: "POST",
    body: JSON.stringify(requestBody(input)),
  }, 90_000);
  if (!data.id) throw new Error("AI did not return a background job identifier.");
  return { id: data.id, status: data.status || "queued" };
}

export async function pollAiCourseGeneration(
  jobId: string,
  requestedTitle?: string,
  sources: AiCourseSource[] = [],
) {
  if (!/^resp_[a-zA-Z0-9_-]+$/.test(jobId)) throw new Error("The course generation job identifier is invalid.");
  const data = await openAiRequest(`https://api.openai.com/v1/responses/${jobId}`);
  const status = data.status || "unknown";
  if (status === "queued" || status === "in_progress") return { status, course: null };
  if (status !== "completed") {
    throw new Error(data.error?.message || data.incomplete_details?.reason || `Course generation ended with status: ${status}.`);
  }
  return { status, course: parseGeneratedCourse(data, { requestedTitle, sources }) };
}

export async function cancelAiCourseGeneration(jobId: string) {
  if (!/^resp_[a-zA-Z0-9_-]+$/.test(jobId)) return;
  await openAiRequest(`https://api.openai.com/v1/responses/${jobId}/cancel`, { method: "POST" });
}
