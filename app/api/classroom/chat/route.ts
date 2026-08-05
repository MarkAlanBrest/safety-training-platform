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
import { isLineupPlan } from "@/lib/classroom-lineup";
import { hotspotsSummary, normalizeFocus } from "@/lib/classroom-focus";
import {
  resolveSlideImageDataUrl,
  sanitizeTeacherSlidePresentation,
} from "@/lib/classroom-teacher";
import { extractResponseOutputText } from "@/lib/parse-response";

type ChatMessage = { role: "user" | "assistant"; content: string };

type RawFlashcard = { front: string; back: string };

type RawPresentation = {
  type:
    | "slide"
    | "question"
    | "exercise"
    | "example"
    | "welcome"
    | "assessment"
    | "flashcard"
    | "dragdrop";
  slideIndex: number | null;
  headline: string | null;
  prompt: string | null;
  body: string | null;
  choices: string[] | null;
  focusX: number | null;
  focusY: number | null;
  focusScale: number | null;
  hotspotId: string | null;
  focusLabel: string | null;
  imageIndex: number | null;
  flashcards: RawFlashcard[] | null;
  dragItems: string[] | null;
  questionIndex: number | null;
  questionCount: number | null;
};

function normalizePresentation(
  raw: RawPresentation | null | undefined,
  plan: ClassroomPlan,
  fallbackSlideIndex: number,
  hotspots = undefined as ClassroomPlan["slides"][number]["hotspots"],
): PresentationView {
  if (!raw?.type) {
    return {
      type: "slide",
      slideIndex: fallbackSlideIndex,
    };
  }

  const slideCount = plan.slides.length;
  const clampSlideIndex = (index: number | null | undefined) => {
    if (typeof index !== "number" || !Number.isFinite(index)) return fallbackSlideIndex;
    return Math.min(slideCount - 1, Math.max(0, Math.floor(index)));
  };

  switch (raw.type) {
    case "slide": {
      const slideIndex = clampSlideIndex(raw.slideIndex);
      const slideHotspots = plan.slides[slideIndex]?.hotspots ?? hotspots;
      return {
        type: "slide",
        slideIndex,
        headline: raw.headline || undefined,
        imageIndex:
          typeof raw.imageIndex === "number" && raw.imageIndex >= 0
            ? raw.imageIndex
            : undefined,
        focus: normalizeFocus(
          {
            x: raw.focusX ?? undefined,
            y: raw.focusY ?? undefined,
            scale: raw.focusScale ?? undefined,
            hotspotId: raw.hotspotId ?? undefined,
            label: raw.focusLabel ?? undefined,
          },
          slideHotspots,
        ),
      };
    }
    case "question":
    case "exercise":
      return {
        type: raw.type,
        headline: raw.headline || "Let's check in",
        prompt: raw.prompt || raw.body || "What do you think?",
        choices: raw.choices?.length ? raw.choices : undefined,
      };
    case "flashcard":
      return {
        type: "flashcard",
        headline: raw.headline || "Practice",
        prompt: raw.prompt || raw.body || undefined,
        flashcards:
          raw.flashcards?.length
            ? raw.flashcards.map((card) => ({
                front: card.front.trim(),
                back: card.back.trim(),
              }))
            : [{ front: "Key idea", back: "Review this topic." }],
      };
    case "dragdrop":
      return {
        type: "dragdrop",
        headline: raw.headline || "Practice",
        prompt: raw.prompt || raw.body || "Put these in the correct order.",
        dragItems: raw.dragItems?.length ? raw.dragItems : ["Step one", "Step two", "Step three"],
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
        questionIndex:
          typeof raw.questionIndex === "number" && raw.questionIndex >= 0
            ? raw.questionIndex
            : undefined,
        questionCount:
          typeof raw.questionCount === "number" && raw.questionCount > 0
            ? raw.questionCount
            : plan.assessment?.length || undefined,
      };
    default:
      return {
        type: "welcome",
        headline: raw.headline || plan.title,
        body: raw.body || raw.prompt || plan.opening,
      };
  }
}

const classroomTeacherTurnSchema = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "presentation", "quickReplies", "expectsResponse"],
  properties: {
    reply: { type: "string" },
    expectsResponse: {
      type: "boolean",
      description:
        "True only when the student should answer now (you asked a question or posed a check). False when you are only teaching or transitioning.",
    },
    presentation: {
      type: "object",
      additionalProperties: false,
      required: [
        "type",
        "slideIndex",
        "headline",
        "prompt",
        "body",
        "choices",
        "focusX",
        "focusY",
        "focusScale",
        "hotspotId",
        "focusLabel",
        "imageIndex",
        "flashcards",
        "dragItems",
        "questionIndex",
        "questionCount",
      ],
      properties: {
        type: {
          type: "string",
          enum: [
            "slide",
            "question",
            "exercise",
            "example",
            "welcome",
            "assessment",
            "flashcard",
            "dragdrop",
          ],
        },
        slideIndex: { type: ["integer", "null"] },
        headline: { type: ["string", "null"] },
        prompt: { type: ["string", "null"] },
        body: { type: ["string", "null"] },
        choices: {
          type: ["array", "null"],
          items: { type: "string" },
        },
        focusX: { type: ["number", "null"], minimum: 0, maximum: 100 },
        focusY: { type: ["number", "null"], minimum: 0, maximum: 100 },
        focusScale: { type: ["number", "null"], minimum: 1, maximum: 2.5 },
        hotspotId: { type: ["string", "null"] },
        focusLabel: { type: ["string", "null"] },
        imageIndex: { type: ["integer", "null"], minimum: 0 },
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
        questionIndex: { type: ["integer", "null"], minimum: 0 },
        questionCount: { type: ["integer", "null"], minimum: 1 },
      },
    },
    quickReplies: {
      type: "array",
      items: { type: "string" },
      minItems: 0,
      maxItems: 3,
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

function filterQuickReplies(_replies: string[] | undefined) {
  // Learners type or speak answers — do not surface choice menus in the UI.
  return [];
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const courseSlug =
      typeof body.courseSlug === "string" ? body.courseSlug : undefined;
    const sectionId = Number(body.sectionId);
    const slideIndex = Number.isInteger(body.slideIndex) ? body.slideIndex : 0;
    const beatIndex = Number.isInteger(body.beatIndex) ? body.beatIndex : 0;
    const assessmentQuestionIndex = Number.isInteger(body.assessmentQuestionIndex)
      ? body.assessmentQuestionIndex
      : 0;
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
        quickReplies: [],
        expectsResponse: false,
      });
    }

    const assessmentCount = plan.assessment?.length || 0;
    const requestOrigin = new URL(request.url).origin;
    const slideImageDataUrl = await resolveSlideImageDataUrl(slide, requestOrigin);
    const lineupMode = isLineupPlan(plan);
    const teachingScript = slide.speakerNotes?.trim()
      ? slide.speakerNotes
      : "No teaching notes on this slide. Teach from the slide image conversationally.";
    const nextSlide = plan.slides[slide.index + 1];
    const nextSlideScript = nextSlide
      ? nextSlide.speakerNotes?.trim() ||
        "No teaching notes on the next slide. Teach from its image conversationally."
      : null;

    const sourceParts = [
      `Course: ${plan.title}`,
      `Opening: ${plan.opening}`,
      `Objectives:\n- ${plan.objectives.join("\n- ")}`,
      `Teaching position: slide ${slide.index + 1} of ${plan.slides.length} (beat ${beatIndex}).`,
      assessmentCount
        ? `Final assessment has ${assessmentCount} question(s). Current assessment question index: ${assessmentQuestionIndex + 1}.`
        : "No final assessment configured.",
      `Current slide (${slide.index + 1}/${plan.slides.length}): ${slide.title}`,
    ];

    if (lineupMode) {
      sourceParts.push(
        `SCRIPT FOR CURRENT SLIDE ${slide.index + 1} ("${slide.title}") — teach exactly this while presentation.slideIndex is ${slide.index}:\n${teachingScript}`,
        nextSlide
          ? `SCRIPT FOR NEXT SLIDE ${nextSlide.index + 1} ("${nextSlide.title}") — teach exactly this if you advance presentation.slideIndex to ${nextSlide.index}:\n${nextSlideScript}`
          : "This is the final slide — there is no next slide.",
        "CRITICAL: your spoken reply must teach the slide whose index you return in presentation.slideIndex. If you stay on the current slide, teach the current script. If you advance to the next slide, your entire reply must teach the next slide's script instead. Never describe one slide while showing another, and never advance more than one slide per turn.",
        "Slides are shown exactly as uploaded. Zoomed or circled details are separate slides in the deck — never zoom or circle on screen.",
        slideImageDataUrl
          ? "The CURRENT slide image is attached below. Read it and teach from the instructor script."
          : "No slide image is available for vision on this beat.",
      );
    } else {
      sourceParts.push(
        `On-slide text (learner can see this — do not read verbatim): ${slide.bodyText}`,
        `INSTRUCTOR SCRIPT (speaker notes — follow this closely to guide your teaching, examples, and questions):\n${teachingScript}`,
        nextSlide
          ? `NEXT SLIDE ${nextSlide.index + 1} ("${nextSlide.title}") speaker notes — use these only if you advance presentation.slideIndex to ${nextSlide.index}:\n${nextSlideScript}`
          : "This is the final slide — there is no next slide.",
        "CRITICAL: your spoken reply must match the slide whose index you return in presentation.slideIndex. Never describe one slide while showing another, and never advance more than one slide per turn.",
        `Hotspots on this slide:\n${hotspotsSummary(slide.hotspots)}`,
        slide.hotspots?.length
          ? "When pointing at the slide, set presentation.hotspotId to one of the hotspot ids above. The system will zoom to that feature."
          : "This slide has no hotspot catalog — leave focusX, focusY, focusScale, hotspotId, and focusLabel null.",
        slideImageDataUrl
          ? "A slide image is attached below. Use it to understand what is in the picture before choosing hotspotId."
          : "No slide image is available for vision on this beat.",
      );
    }

    sourceParts.push(
      `Current presentation mode on screen: ${presentation?.type || "welcome"}`,
      `Instructor preferences:\n${classroomInstructorPrompt(builderConfig)}`,
      lessonBeatSummary(plan),
    );

    const source = sourceParts.join("\n\n");

    const lineupInstructions = [
      "You are the classroom instructor, pacing this class the way a real teacher advances slides — the student does not need to click anything to move forward. You advance on your own after teaching each part, the same way you'd naturally move on once an idea has landed.",
      "Teach conversationally in your own words from the content-slide teaching notes.",
      "YOUR REPLY MUST MATCH THE SLIDE ON SCREEN: teach exactly the script for the slide index you return in presentation.slideIndex. Staying put means teach the current script; advancing means teach the next slide's script for your whole reply.",
      "Each turn, advance exactly one beat in the lineup (next slide, formative check, or activity) and teach it fully, unless you are waiting on the student to answer something you just asked.",
      "When moving on from the welcome screen, move to slide 1 (slideIndex 0) and teach it.",
      "Never advance more than one slide in a single turn.",
      "If the student asks a question, answer it clearly while staying on the current slide — do not advance.",
      "Stick strictly to the lesson content. Do not add icebreakers, ask what the student already knows, or introduce topics that are not in the teaching notes or lineup.",
      "The slide image is shown full-screen as-is. Do not zoom, pan, or circle anything — the author already added separate slides for close-ups or highlights.",
      "Leave focusX, focusY, focusScale, hotspotId, and focusLabel null at all times.",
      "While teaching, keep presentation.type slide and set presentation.slideIndex to the slide you are teaching.",
      "Follow the lesson lineup in order.",
      "COMPREHENSION CHECKS (formative checks of type multipleChoice, trueFalse, shortAnswer, or scenario): ask these directly in your spoken reply, like a teacher pausing to check the class — do NOT change presentation.type or presentation.choices for these, keep presentation.type slide and presentation.slideIndex on the current slide. For multipleChoice/trueFalse, state the question and read out the options in your reply text. The lesson lineup below includes the correct answer for each formative check in brackets — use it to grade the student's spoken/typed answer, but never reveal it before they answer. If they're right, give brief genuine positive feedback and move on. If they're wrong, give a friendly correction with the right answer and a one-sentence reason, then move on — do not dwell or re-ask the same question.",
      "PRACTICE ACTIVITIES (formative checks of type flashcard or dragdrop, and click-the-spot hotspot checks): these use a dedicated on-screen activity instead of chat — use presentation.type flashcard or dragdrop as appropriate when you reach one of these in the lineup.",
      "Teach most slides without forcing a question — explain, emphasize, give examples from the notes, then move on when the idea lands. Only ask a comprehension check where the lineup places one, and time it naturally — right after you've just taught the point it covers, not on a rigid schedule.",
      "When you are only teaching or transitioning, set expectsResponse to false so the class keeps moving.",
      "When you ask a comprehension check or need an answer, set expectsResponse to true and wait.",
      "Only ask questions that come from the lineup's formative checks and activities, or that directly check understanding of what you just taught.",
      "Use presentation.type flashcard or dragdrop only for inserted practice activities of those types.",
      "Return an empty quickReplies array unless you have a rare non-answer helper.",
      "Keep replies concise (2–3 sentences) unless the student asks for more.",
      "Return JSON only.",
    ].join(" ");

    const legacyInstructions = [
      "You are the classroom instructor. YOU control the screen and pacing — the student does not click through slides.",
      "Teach conversationally in your own words. Never read on-screen bullet points verbatim.",
      "Use speaker notes as your private script for emphasis, examples, and questions.",
      "YOUR REPLY MUST MATCH THE SLIDE ON SCREEN: teach the slide index you return in presentation.slideIndex, and never advance more than one slide per turn.",
      "Signal importance in your reply: pay attention to this part, this might be on the test, or a real job-site example when it helps.",
      "While teaching, keep presentation.type slide and set presentation.slideIndex to the slide you are teaching.",
      "To point at the slide: ONLY set presentation.hotspotId to an id from the Hotspots catalog when you say look here or pay attention. Never invent focusX or focusY.",
      "Leave focusX, focusY, focusScale, hotspotId, and focusLabel null unless you are deliberately highlighting a cataloged hotspot.",
      "Use focusScale around 1.4 only when hotspotId is set and you want emphasis.",
      "Teach most slides without forcing a question — explain, emphasize, give examples, then move on when the idea lands.",
      "Ask a question only when you genuinely want to check understanding, every few slides, or when the topic is easy to misunderstand.",
      "When you are only teaching or transitioning to the next slide, set expectsResponse to false and do not end with a question.",
      "When you ask a question or need an answer, set expectsResponse to true.",
      "Ask open-ended questions in your reply and wait for the student to type or speak — do not list answer options.",
      "Do not set presentation.choices or quickReplies that reveal answers.",
      "For formative checks, keep presentation.type slide (or welcome) while you ask the question in reply.",
      "Use presentation.type question or exercise only without choices when the center screen should show the question — never include choices.",
      "Use presentation.type assessment for the final test with prompt only — no choices in presentation.",
      "Advance slides only when the student seems ready — wrong or unsure answers mean reteach, explain differently, or practice before moving on.",
      "If the student says they have a question, answer it clearly without advancing unless they are ready.",
      "If the student completes a practice activity, decide whether to continue teaching, practice more, or move forward.",
      "Use presentation.type flashcard or dragdrop when a practice activity is the right next move.",
      "Set questionIndex and questionCount when advancing through final assessment questions.",
      "Cover all objectives before the final assessment.",
      "Return an empty quickReplies array unless you have a rare non-answer helper.",
      "Keep replies concise (2–3 sentences) unless the student asks for more.",
      "Return JSON only.",
    ].join(" ");

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5.6-sol",
        instructions: lineupMode ? lineupInstructions : legacyInstructions,
        text: {
          format: {
            type: "json_schema",
            name: "classroom_teacher_turn",
            schema: classroomTeacherTurnSchema,
          },
        },
        input: [
          { role: "developer", content: source },
          ...(slideImageDataUrl
            ? [
                {
                  role: "user",
                  content: [
                    {
                      type: "input_text",
                      text: lineupMode
                        ? "This is the slide image the learner currently sees. Read it and teach from the instructor script."
                        : "This is the slide image the learner currently sees. Use it to understand visual content. Only point using hotspotId values from the catalog in the lesson context.",
                    },
                    {
                      type: "input_image",
                      image_url: slideImageDataUrl,
                    },
                  ],
                },
              ]
            : []),
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
      expectsResponse?: boolean;
    };

    const reply =
      parsed.reply?.trim() ||
      "Let's keep going — tell me what you're thinking so far.";
    const presentationView = sanitizeTeacherSlidePresentation(
      normalizePresentation(
        parsed.presentation,
        plan,
        slide.index,
        slide.hotspots,
      ),
      slide,
    );

    return Response.json({
      reply,
      presentation: presentationView,
      quickReplies: filterQuickReplies(parsed.quickReplies),
      expectsResponse: Boolean(parsed.expectsResponse),
    });
  } catch (error) {
    console.error("Classroom chat failed:", error);
    const message =
      error instanceof Error ? error.message : "The instructor could not respond.";
    return Response.json({ error: message }, { status: 500 });
  }
}
