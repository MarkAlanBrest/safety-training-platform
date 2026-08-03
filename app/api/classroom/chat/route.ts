export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";
import {
  classroomPlanForSlug,
  isClassroomPlan,
  type ClassroomPlan,
  type PresentationView,
} from "@/lib/classroom";
import {
  classroomInstructorPrompt,
  defaultClassroomBuilderConfig,
} from "@/lib/classroom-builder";
import { lessonBeatSummary } from "@/lib/classroom-lesson";
import { extractResponseOutputText } from "@/lib/parse-response";

type ChatMessage = { role: "user" | "assistant"; content: string };

type RawPresentation = {
  type: "slide" | "question" | "exercise" | "example" | "welcome" | "assessment";
  slideIndex: number | null;
  headline: string | null;
  prompt: string | null;
  body: string | null;
  choices: string[] | null;
};

function normalizePresentation(
  raw: RawPresentation | null | undefined,
  fallbackSlideIndex: number,
): PresentationView {
  if (!raw?.type) {
    return {
      type: "slide",
      slideIndex: fallbackSlideIndex,
    };
  }

  switch (raw.type) {
    case "slide":
      return {
        type: "slide",
        slideIndex:
          typeof raw.slideIndex === "number" ? raw.slideIndex : fallbackSlideIndex,
        headline: raw.headline || undefined,
      };
    case "question":
    case "exercise":
      return {
        type: raw.type,
        headline: raw.headline || "Let's check in",
        prompt: raw.prompt || raw.body || "What do you think?",
        choices: raw.choices?.length ? raw.choices : undefined,
      };
    case "example":
      return {
        type: "example",
        headline: raw.headline || "Example",
        body: raw.body || raw.prompt || "",
        imageDataUrl: undefined,
      };
    case "assessment":
      return {
        type: "assessment",
        headline: raw.headline || "Final assessment",
        prompt: raw.prompt || raw.body || "Answer the question below.",
        choices: raw.choices?.length ? raw.choices : undefined,
      };
    default:
      return {
        type: "welcome",
        headline: raw.headline || "Welcome",
        body: raw.body || raw.prompt || "",
      };
  }
}

const classroomTeacherTurnSchema = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "presentation", "quickReplies"],
  properties: {
    reply: { type: "string" },
    presentation: {
      type: "object",
      additionalProperties: false,
      required: ["type", "slideIndex", "headline", "prompt", "body", "choices"],
      properties: {
        type: {
          type: "string",
          enum: ["slide", "question", "exercise", "example", "welcome", "assessment"],
        },
        slideIndex: { type: ["integer", "null"] },
        headline: { type: ["string", "null"] },
        prompt: { type: ["string", "null"] },
        body: { type: ["string", "null"] },
        choices: {
          type: ["array", "null"],
          items: { type: "string" },
        },
      },
    },
    quickReplies: {
      type: "array",
      items: { type: "string" },
      minItems: 3,
      maxItems: 6,
    },
  },
} as const;

async function resolvePlan(
  courseSlug: string,
  sectionId?: number,
): Promise<ClassroomPlan | null> {
  const staticPlan = classroomPlanForSlug(courseSlug);
  if (staticPlan) return staticPlan;

  if (!Number.isInteger(sectionId)) {
    const course = await prisma.masonCourse.findUnique({
      where: { slug: courseSlug, courseType: "classroom" },
      include: {
        sections: {
          orderBy: { position: "asc" },
          take: 1,
          select: { lessonPlan: true },
        },
      },
    });
    const plan = course?.sections[0]?.lessonPlan;
    return isClassroomPlan(plan) ? plan : null;
  }

  const section = await prisma.masonSection.findUnique({
    where: { id: sectionId },
    select: { lessonPlan: true },
  });
  return isClassroomPlan(section?.lessonPlan) ? section.lessonPlan : null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const courseSlug =
      typeof body.courseSlug === "string" ? body.courseSlug : undefined;
    const sectionId = Number(body.sectionId);
    const slideIndex = Number.isInteger(body.slideIndex) ? body.slideIndex : 0;
    const presentation = body.presentation as PresentationView | undefined;
    const messages = (Array.isArray(body.messages) ? body.messages : [])
      .filter(
        (item: ChatMessage) =>
          (item.role === "user" || item.role === "assistant") &&
          typeof item.content === "string",
      )
      .slice(-12) as ChatMessage[];

    if (!courseSlug || !messages.length) {
      return Response.json({ error: "A message is required." }, { status: 400 });
    }

    const plan = await resolvePlan(
      courseSlug,
      Number.isInteger(sectionId) ? sectionId : undefined,
    );
    if (!plan) {
      return Response.json({ error: "Classroom lesson not found." }, { status: 404 });
    }

    const slide = plan.slides[slideIndex] || plan.slides[0];
    const builderConfig = plan.config || defaultClassroomBuilderConfig();
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return Response.json({
        reply:
          "I'm ready to teach once the OpenAI API key is connected. You can still browse the slides while we set that up.",
        presentation: {
          type: "slide",
          slideIndex: slide.index,
          headline: slide.title,
        },
        quickReplies: [
          "That makes sense",
          "Could you rephrase that?",
          "Raise your hand",
        ],
      });
    }

    const source = [
      `Course: ${plan.title}`,
      `Opening: ${plan.opening}`,
      `Objectives:\n- ${plan.objectives.join("\n- ")}`,
      `Current slide (${slide.index + 1}/${plan.slides.length}): ${slide.title}`,
      `Slide text: ${slide.bodyText}`,
      `Speaker notes: ${slide.speakerNotes || "(none)"}`,
      `Presentation mode: ${presentation?.type || "welcome"}`,
      `Instructor preferences:\n${classroomInstructorPrompt(builderConfig)}`,
      lessonBeatSummary(plan),
    ].join("\n\n");

    const conversationHint =
      builderConfig.settings.conversationMode === "raise-hand"
        ? "The student should raise their hand before asking questions. Offer a Raise your hand quick reply when appropriate."
        : builderConfig.settings.conversationMode === "checkpoints-only"
          ? "Only invite questions at lesson checkpoints."
          : "The student may interrupt anytime with questions.";

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5.6-sol",
        instructions: [
          "You are a real classroom instructor, not a chatbot reading slides.",
          "Teach through dialogue: ask what the learner knows, respond to their ideas, give short explanations, show examples, and check understanding.",
          "Keep replies concise (2-4 sentences) and conversational.",
          "During checkpoints, use presentation.type question or exercise with 3-4 answer choices.",
          "During the final assessment, use presentation.type assessment with clear multiple-choice options.",
          "When teaching a new slide, set presentation.type slide with the matching slideIndex.",
          "Ground answers in the supplied slide knowledge.",
          conversationHint,
          "Return JSON only.",
        ].join(" "),
        text: {
          format: {
            type: "json_schema",
            name: "classroom_teacher_turn",
            schema: classroomTeacherTurnSchema,
          },
        },
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

    const outputText = extractResponseOutputText(data);
    if (!outputText) {
      throw new Error("The instructor returned an empty response.");
    }

    const parsed = JSON.parse(outputText) as {
      reply?: string;
      presentation?: RawPresentation;
      quickReplies?: string[];
    };

    const reply =
      parsed.reply?.trim() ||
      "Let's keep going — tell me what you're thinking so far.";
    const presentationView = normalizePresentation(
      parsed.presentation,
      slide.index,
    );

    if (
      presentationView.type === "slide" &&
      plan.slides[presentationView.slideIndex]
    ) {
      presentationView.headline =
        presentationView.headline ||
        plan.slides[presentationView.slideIndex].title;
    }

    return Response.json({
      reply,
      presentation: presentationView,
      quickReplies: parsed.quickReplies?.length
        ? parsed.quickReplies
        : [
            "That makes sense",
            "Could you rephrase that?",
            "Raise your hand",
          ],
    });
  } catch (error) {
    console.error("Classroom chat failed:", error);
    const message =
      error instanceof Error ? error.message : "The instructor could not respond.";
    return Response.json({ error: message }, { status: 500 });
  }
}
