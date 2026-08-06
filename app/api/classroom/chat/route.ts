export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";
import {
  classroomPlanForSlug,
  isClassroomPlan,
  type ClassroomCheckQuestion,
  type ClassroomPlan,
  type PresentationView,
} from "@/lib/classroom";
import {
  classroomInstructorPrompt,
  defaultClassroomBuilderConfig,
} from "@/lib/classroom-builder";
import { lessonBeatSummary } from "@/lib/classroom-lesson";
import { coveredTopicsSummary, isLineupPlan } from "@/lib/classroom-lineup";
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

type RawCheckQuestion = {
  prompt: string;
  type: "multipleChoice" | "trueFalse" | "shortAnswer";
  options: string[] | null;
} | null;

function normalizeCheckQuestion(raw: RawCheckQuestion | undefined): ClassroomCheckQuestion | null {
  const prompt = raw?.prompt?.trim();
  if (!raw || !prompt) return null;
  const options = raw.options?.map((option) => option.trim()).filter(Boolean);
  return {
    prompt,
    type: raw.type,
    options: options?.length ? options : undefined,
  };
}

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
  required: ["reply", "presentation", "quickReplies", "expectsResponse", "checkQuestion", "lastAnswerCorrect"],
  properties: {
    reply: { type: "string" },
    expectsResponse: {
      type: "boolean",
      description:
        "True only when the student should answer now (you asked a question or posed a check). False when you are only teaching or transitioning.",
    },
    lastAnswerCorrect: {
      type: ["boolean", "null"],
      description:
        "Set true or false ONLY on the turn where you are grading the student's answer to a comprehension check you asked last turn. Null on every other turn (teaching, asking a new check, answering their own question, etc).",
    },
    checkQuestion: {
      type: ["object", "null"],
      description:
        "Set ONLY on a turn where you are asking a comprehension check. Holds the actual question so the UI can show it in its own dedicated card — do not also restate the question or its options inside reply. Null on every other turn.",
      additionalProperties: false,
      required: ["prompt", "type", "options"],
      properties: {
        prompt: { type: "string" },
        type: { type: "string", enum: ["multipleChoice", "trueFalse", "shortAnswer"] },
        options: {
          type: ["array", "null"],
          description: "The answer options for multipleChoice or trueFalse. Null for shortAnswer.",
          items: { type: "string" },
        },
      },
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
    const includeImage = body.includeImage !== false;
    const studentName = typeof body.studentName === "string" ? body.studentName.trim().slice(0, 60) : "";
    const taughtSlideIndices: number[] = Array.isArray(body.taughtSlideIndices)
      ? body.taughtSlideIndices.filter((item: unknown): item is number => Number.isInteger(item))
      : [];
    const streak = {
      correctInRow: Number.isInteger(body.streak?.correctInRow) ? body.streak.correctInRow : 0,
      incorrectInRow: Number.isInteger(body.streak?.incorrectInRow) ? body.streak.incorrectInRow : 0,
    };
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
        code: "AI_NOT_CONFIGURED",
        error: "AI_NOT_CONFIGURED",
        reply:
          "The AI instructor is not connected yet. An administrator needs to add OPENAI_API_KEY to the server environment (for example in Vercel → Project Settings → Environment Variables), then redeploy this site.",
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
    // Skipping the image fetch/encode on follow-up turns (answering a question, grading,
    // finishing an activity) meaningfully cuts response latency — the model already has
    // the slide's teaching script and doesn't need fresh vision to reply on the same slide.
    const slideImageDataUrl = includeImage
      ? await resolveSlideImageDataUrl(slide, requestOrigin)
      : null;
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

    if (studentName) {
      sourceParts.push(
        `Student's name: ${studentName}. Use it naturally now and then — greeting them, praising a streak, re-engaging them after a pause — not in every single reply, that reads as robotic.`,
      );
    }

    const coveredTopics = coveredTopicsSummary(
      plan,
      taughtSlideIndices,
      [slide.index, nextSlide?.index].filter((value): value is number => typeof value === "number"),
    );
    if (coveredTopics) sourceParts.push(coveredTopics);

    if (streak.correctInRow >= 2) {
      sourceParts.push(
        `Performance signal: the student has answered the last ${streak.correctInRow} comprehension checks correctly in a row. This is a good moment to apply the "if the student excels" guidance above — e.g. pick up the pace, ask something a bit deeper, or simply acknowledge they're doing great. Don't overdo the praise.`,
      );
    } else if (streak.incorrectInRow >= 2) {
      sourceParts.push(
        `Performance signal: the student has missed the last ${streak.incorrectInRow} comprehension checks in a row. Apply the "if the student struggles" guidance above — re-explain more simply, offer a hint, or use another example before moving on.`,
      );
    }

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
      "REQUIRED COMPREHENSION CHECKS: like a real teacher, you must periodically stop and actually quiz the student — this is not optional. Roughly every 2-3 slides, and always right after you've just taught something important, ask one genuine question: true/false, multiple choice, or short answer.",
      "If the lineup places a formative check (type multipleChoice, trueFalse, shortAnswer, or scenario) at this point, ask exactly that question — the lesson lineup below gives you the correct answer for it in brackets; use it to grade the student, but never reveal it before they answer. A scenario check maps to checkQuestion.type multipleChoice or shortAnswer depending on which one the lineup gives it options for.",
      "If the lineup has gone 2-3 slides without a formative check, don't skip questioning — write your own true/false, multiple choice, or short-answer question testing the specific point you just taught, using the teaching script as your answer key.",
      "HOW TO ASK A COMPREHENSION CHECK: put the actual question in the separate checkQuestion field (prompt, type, and options), NOT in your reply text — the UI shows checkQuestion in its own dedicated card, so reply must not restate the question or list its options. Your reply should only be a short natural lead-in, e.g. 'Let's check that this landed — I've got a quick question for you.' Set checkQuestion.type to multipleChoice, trueFalse, or shortAnswer, and fill options for multipleChoice/trueFalse (leave options null for shortAnswer). On every other turn, checkQuestion must be null.",
      "Do NOT change presentation.type or set presentation.choices for a comprehension check — keep presentation.type slide and presentation.slideIndex on the current slide; the question lives in checkQuestion, not in the slide.",
      "THE STUDENT MUST ANSWER BEFORE YOU CONTINUE: when you set checkQuestion, also set expectsResponse true and stop there — do not teach further content or advance the slide in the same turn. Only continue once they've answered.",
      "GIVE REAL FEEDBACK, not a one-word verdict — like a teacher would: if they're right, briefly affirm it and reinforce why it's right in one sentence, then move on. If they're wrong, correct them warmly, state the right answer, and explain in a sentence or two why — do not just say 'not quite,' actually reteach the point briefly so it sticks. Then move on; do not re-ask the same question. Feedback goes in reply as normal narration, not in checkQuestion.",
      "GRADING FLAG: on the turn where you give that feedback, set lastAnswerCorrect to true or false to match your verdict. On every other turn (teaching, asking a new check, answering their own question), leave lastAnswerCorrect null.",
      "PRACTICE ACTIVITIES (formative checks of type flashcard or dragdrop, and click-the-spot hotspot checks): these use a dedicated on-screen activity instead of chat — use presentation.type flashcard or dragdrop as appropriate when you reach one of these in the lineup.",
      "When you are only teaching or transitioning, set expectsResponse to false so the class keeps moving.",
      "Use presentation.type flashcard or dragdrop only for inserted practice activities of those types.",
      "ADAPT TO HOW THEY'RE DOING: if a performance signal about a correct or incorrect streak appears in the lesson context, actually act on it using the matching struggle/excel guidance in your instructor preferences above — don't just note it and continue as normal. This is what makes you feel like a real teacher paying attention, not a script.",
      "REFERENCE EARLIER CONTENT when it's genuinely useful: if the lesson context lists topics already covered, tie the current point back to one of them when it strengthens the explanation (e.g. 'remember when we covered X — this builds on that'). Don't force it on every slide, and don't re-teach the earlier topic, just a natural callback.",
      "LIGHT ENCOURAGEMENT: like a real teacher, drop in brief, genuine encouragement at natural moments — a streak of correct answers, finishing a tough section, getting through a milestone in the lesson. Keep it short and varied, never a stock phrase repeated every turn, and never at the expense of the actual teaching content.",
      "RAPPORT QUESTIONS (different from comprehension checks): every so often, ask a quick, low-stakes engagement question the way a real teacher checks the room — 'Have you run into this before?', 'Does this look familiar from the job site?', 'Ever seen someone skip this step?' These are casual and NOT graded — do not set checkQuestion or lastAnswerCorrect for these, just ask it naturally as part of reply, set expectsResponse true, and briefly acknowledge whatever they say ('Makes sense' / 'Good, then this next part will click fast') before continuing to teach. Use these sparingly and don't let them substitute for the required comprehension checks.",
      "Return an empty quickReplies array unless you have a rare non-answer helper.",
      "Keep teaching replies concise (2–3 sentences) unless the student asks for more; feedback after a comprehension check can run a sentence or two longer since explaining the answer matters.",
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
      "When you ask a comprehension question, put it in the separate checkQuestion field (prompt, type, options) instead of your reply text — the UI shows it in its own dedicated card. Set checkQuestion.type to multipleChoice, trueFalse, or shortAnswer, with options filled for multipleChoice/trueFalse and left null for shortAnswer. Set expectsResponse true whenever checkQuestion is set, and leave checkQuestion null on every other turn.",
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
      "When grading a comprehension check, set lastAnswerCorrect true or false to match your verdict; leave it null every other turn.",
      "If the lesson context gives the student's name, use it naturally now and then — not every reply. If it lists topics already covered, make a natural callback when it strengthens a point. If it flags a correct or incorrect streak, actually adapt (reteach, hint, speed up, go deeper) rather than continuing as normal.",
      "Every so often, ask a quick, ungraded rapport question the way a real teacher checks the room — 'Have you run into this before?', 'Does this look familiar?' Don't set lastAnswerCorrect for these, just acknowledge their answer briefly and move on. Use sparingly, and don't let it replace a real comprehension check.",
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
      const apiMessage =
        typeof data?.error?.message === "string" ? data.error.message : "";
      if (response.status === 401 || /api key/i.test(apiMessage)) {
        throw new Error(
          "The OpenAI API key on the server is missing or invalid. Check OPENAI_API_KEY in your hosting environment and redeploy.",
        );
      }
      throw new Error(apiMessage || "The instructor could not respond.");
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
      checkQuestion?: RawCheckQuestion;
      lastAnswerCorrect?: boolean | null;
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
      checkQuestion: normalizeCheckQuestion(parsed.checkQuestion),
      lastAnswerCorrect: typeof parsed.lastAnswerCorrect === "boolean" ? parsed.lastAnswerCorrect : null,
    });
  } catch (error) {
    console.error("Classroom chat failed:", error);
    const message =
      error instanceof Error ? error.message : "The instructor could not respond.";
    return Response.json({ error: message }, { status: 500 });
  }
}
