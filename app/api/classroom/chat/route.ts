export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";
import {
  classroomPlanForSlug,
  hydrateClassroomPlan,
  isClassroomPlan,
  ClassroomCheckQuestion,
  type ClassroomPlan,
  type PresentationView,
} from "@/lib/classroom";
import { classroomPlanFromSections } from "@/lib/classroom-chapters";
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
import {
  dedupeReplyWithCheckQuestion,
  speakerNotesHaveEmbeddedNarration,
} from "@/lib/classroom-speech";
import { chapterAtTime, formatTimestamp, resolveVideoCourseMarkers } from "@/lib/classroom-video";
import { getAdminSession } from "@/lib/admin-session";

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

const planCache = new Map<string, { plan: ClassroomPlan; expiresAt: number }>();
const PLAN_CACHE_TTL_MS = 60_000;

async function resolvePlan(
  courseSlug: string,
  sectionId?: number,
): Promise<ClassroomPlan | null> {
  const cacheKey = `${courseSlug}:${sectionId ?? "all"}`;
  const cached = planCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.plan;
  }

  const staticPlan = classroomPlanForSlug(courseSlug);
  if (staticPlan) {
    planCache.set(cacheKey, { plan: staticPlan, expiresAt: Date.now() + PLAN_CACHE_TTL_MS });
    return staticPlan;
  }

  let resolved: ClassroomPlan | null = null;

  if (!Number.isInteger(sectionId)) {
    const course = await prisma.masonCourse.findUnique({
      where: { slug: courseSlug, courseType: "classroom" },
      include: {
        sections: {
          orderBy: { position: "asc" },
          select: { id: true, title: true, position: true, lessonPlan: true },
        },
      },
    });
    if (!course) return null;
    let globalIndexOffset = 0;
    const sections = course.sections.flatMap((section: {
      id: number;
      title: string;
      position: number;
      lessonPlan: unknown;
    }) => {
      if (!isClassroomPlan(section.lessonPlan)) return [];
      const plan = hydrateClassroomPlan(section.lessonPlan, courseSlug, [], {
        chapterPosition: section.position,
        globalIndexOffset,
      });
      globalIndexOffset += plan.slides.length;
      return [{ ...section, plan }];
    });
    resolved = sections.length ? classroomPlanFromSections(course.title, sections) : null;
  } else {
    const section = await prisma.masonSection.findUnique({
      where: { id: sectionId },
      select: { lessonPlan: true },
    });
    resolved = isClassroomPlan(section?.lessonPlan) ? section.lessonPlan : null;
  }

  if (resolved) {
    planCache.set(cacheKey, { plan: resolved, expiresAt: Date.now() + PLAN_CACHE_TTL_MS });
  }
  return resolved;
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
    const answeredCheckPrompts: string[] = (
      Array.isArray(body.answeredCheckPrompts)
        ? body.answeredCheckPrompts.filter(
            (item: unknown): item is string => typeof item === "string",
          )
        : []
    )
      .map((item: string) => item.trim())
      .filter((item: string) => item.length > 0);
    const messages = (Array.isArray(body.messages) ? body.messages : [])
      .filter(
        (item: ChatMessage) =>
          (item.role === "user" || item.role === "assistant") &&
          typeof item.content === "string",
      )
      .slice(-8) as ChatMessage[];

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

    const builderConfig = plan.config || defaultClassroomBuilderConfig();
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return Response.json({
        reply:
          "I'm ready to teach once the OpenAI API key is connected. You can still watch the video while we set that up.",
        presentation: {
          type: "welcome",
          headline: plan.title,
          body: plan.opening,
        },
        quickReplies: [],
        expectsResponse: false,
      });
    }

    if (plan.videoCourse) {
      const videoTimeSeconds = Number(body.videoTimeSeconds) || 0;
      const activeChapter = chapterAtTime(plan.videoCourse.chapters, videoTimeSeconds);
      const adminSession = await getAdminSession(request);
      const playbackMarkers = resolveVideoCourseMarkers(plan.videoCourse, {
        previewDraft: Boolean(adminSession),
      });
      const activeMarker = playbackMarkers.find(
        (marker) => marker.id === body.activeMarkerId,
      );
      const videoContext = [
        `Course: ${plan.title}`,
        `Playback position: ${formatTimestamp(videoTimeSeconds)}`,
        activeChapter ? `Chapter: ${activeChapter.title}` : "Chapter: (not in a marked chapter)",
        activeMarker
          ? `Active stop point: ${activeMarker.label || activeMarker.kind} at ${formatTimestamp(activeMarker.atSeconds)}.`
          : "The learner opened Ask AI during video playback.",
        `Instructor preferences:\n${classroomInstructorPrompt(builderConfig)}`,
      ].join("\n\n");

      const videoInstructions = [
        "You are a warm, concise AI instructor for a full-screen video course.",
        "The learner is watching a video and may pause to ask you a question.",
        "Keep replies to 2-3 sentences unless they ask for more detail.",
        "Do not invent visuals — you cannot see the video frame.",
        "If they seem ready to continue, encourage them to resume watching.",
        "Return JSON only.",
      ].join(" ");

      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model:
            process.env.OPENAI_CLASSROOM_MODEL ||
            process.env.OPENAI_MODEL ||
            "gpt-4.1-mini",
          input: [
            {
              role: "system",
              content: [{ type: "input_text", text: `${videoInstructions}\n\n${videoContext}` }],
            },
            ...messages.map((message) => ({
              role: message.role,
              content: [{ type: "input_text", text: message.content }],
            })),
          ],
          text: {
            format: {
              type: "json_schema",
              name: "classroom_turn",
              schema: classroomTeacherTurnSchema,
              strict: true,
            },
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "OpenAI request failed.");
      }

      const payload = await response.json();
      const outputText = extractResponseOutputText(payload);
      if (!outputText) throw new Error("The instructor returned an empty response.");

      const parsed = JSON.parse(outputText) as {
        reply?: string;
        expectsResponse?: boolean;
        checkQuestion?: RawCheckQuestion;
        lastAnswerCorrect?: boolean | null;
      };

      return Response.json({
        reply: parsed.reply?.trim() || "I'm here if you have questions about this part.",
        presentation: {
          type: "welcome",
          headline: plan.title,
          body: plan.opening,
        },
        quickReplies: [],
        expectsResponse: Boolean(parsed.expectsResponse),
        checkQuestion: normalizeCheckQuestion(parsed.checkQuestion),
        lastAnswerCorrect:
          typeof parsed.lastAnswerCorrect === "boolean" ? parsed.lastAnswerCorrect : null,
      });
    }

    const slide = plan.slides[slideIndex] || plan.slides[0];
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
    const embeddedSlideNarration = speakerNotesHaveEmbeddedNarration(teachingScript);
    // In lineup mode the browser owns navigation and has already selected the beat.
    // Do not send the following slide's script to the model on every turn.
    const nextSlide = lineupMode ? undefined : plan.slides[slide.index + 1];
    const nextSlideScript = nextSlide
      ? nextSlide.speakerNotes?.trim() ||
        "No teaching notes on the next slide. Teach from its image conversationally."
      : null;

    const sourceParts = [
      `Course: ${plan.title}`,
      `Objectives:\n- ${plan.objectives.join("\n- ")}`,
      `Teaching position: slide ${slide.index + 1} of ${plan.slides.length} (beat ${beatIndex}).`,
      assessmentCount
        ? `Final assessment has ${assessmentCount} question(s). Current assessment question index: ${assessmentQuestionIndex + 1}.`
        : "No final assessment configured.",
      `Current slide (${slide.index + 1}/${plan.slides.length}): ${slide.title}`,
    ];

    if (embeddedSlideNarration) {
      sourceParts.push(
        "EMBEDDED SLIDE AUDIO: This slide plays its own narration from embedded PowerPoint audio. Return reply as an empty string unless you are asking a comprehension check (one short lead-in sentence only) or giving feedback on the student's latest answer. Do not narrate, paraphrase, or teach this slide aloud — the embedded audio handles narration.",
      );
    }

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
      [
        "AUTHOR CUES IN SPEAKER NOTES:",
        "Treat a line beginning with AI: or [AI] as a private direction from the course author, never as words to read aloud.",
        "Follow natural-language cues too when their intent is clear, such as 'ask a follow-up on this slide' or 'ask a multiple-choice question here.'",
        "For an ungraded follow-up, ask the requested question in reply, keep the current slide visible, set expectsResponse true, and leave checkQuestion null.",
        "For a multiple-choice, true/false, or short-answer knowledge check, use checkQuestion, keep the current slide visible, set expectsResponse true, and do not reveal the answer before the learner responds.",
        "If the author supplies exact wording, options, or an answer, preserve them. If wording or options are omitted, create them only from this slide's teaching content.",
        "If the author explicitly says to read the visible slide text, inspect the attached image and read that text accurately; this is an exception to the normal preference for paraphrasing slide bullets.",
        "For a conditional visual cue such as 'if the graphic shows X, ask Y,' inspect the attached current-slide image. Execute the cue only when the condition is visibly supported; never claim to see something that is not visible.",
        "Complete an author cue on this slide before advancing. After the learner answers, respond naturally and then continue instead of asking the same cue again.",
      ].join(" "),
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

    if (answeredCheckPrompts.length) {
      sourceParts.push(
        `Comprehension checks the student has already answered in this class (do NOT ask these again): ${answeredCheckPrompts.map((prompt) => `"${prompt}"`).join(", ")}.`,
      );
    }

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
      "Do not read slide text verbatim unless the author explicitly requests it in an AI: cue; when requested, follow that cue exactly.",
      "YOUR REPLY MUST MATCH THE SLIDE ON SCREEN: teach exactly the script for the slide index you return in presentation.slideIndex. Staying put means teach the current script; advancing means teach the next slide's script for your whole reply.",
      "Each turn, advance exactly one beat in the lineup (next slide, formative check, or activity) and teach it fully, unless you are waiting on the student to answer something you just asked.",
      "The course begins directly on slide 1 (slideIndex 0); there is no generated welcome screen.",
      "Never advance more than one slide in a single turn.",
      "If the student asks a question, answer it clearly while staying on the current slide — do not advance.",
      "Stick strictly to the lesson content. Do not add icebreakers, ask what the student already knows, or introduce topics that are not in the teaching notes or lineup.",
      "The slide image is shown full-screen as-is. Do not zoom, pan, or circle anything — the author already added separate slides for close-ups or highlights.",
      "Leave focusX, focusY, focusScale, hotspotId, and focusLabel null at all times.",
      "While teaching, keep presentation.type slide and set presentation.slideIndex to the slide you are teaching.",
      "Follow the lesson lineup in order.",
      "Ask comprehension questions only when the lesson lineup or an AI: author cue in the current slide's speaker notes explicitly requests one. Do not invent additional questions.",
      "If the lineup places a formative check (type multipleChoice, trueFalse, shortAnswer, or scenario) at this point, ask exactly that question — the lesson lineup below gives you the correct answer for it in brackets; use it to grade the student, but never reveal it before they answer. A scenario check maps to checkQuestion.type multipleChoice or shortAnswer depending on which one the lineup gives it options for.",
      "HOW TO ASK A COMPREHENSION CHECK: put the actual question in the separate checkQuestion field (prompt, type, and options), NOT in your reply text — the UI shows checkQuestion in its own dedicated card, so reply must not restate the question or list its options. Your reply should only be a short natural lead-in, e.g. 'Let's check that this landed — I've got a quick question for you.' Set checkQuestion.type to multipleChoice, trueFalse, or shortAnswer, and fill options for multipleChoice/trueFalse (leave options null for shortAnswer). On every other turn, checkQuestion must be null.",
      "Do NOT change presentation.type or set presentation.choices for a comprehension check — keep presentation.type slide and presentation.slideIndex on the current slide; the question lives in checkQuestion, not in the slide.",
      "THE STUDENT MUST ANSWER BEFORE YOU CONTINUE: when you set checkQuestion, also set expectsResponse true and stop there — do not teach further content or advance the slide in the same turn. Only continue once they've answered.",
      "GIVE REAL FEEDBACK, not a one-word verdict — like a teacher would: if they're right, briefly affirm it and reinforce why it's right in one sentence, then move on. If they're wrong, correct them warmly, state the right answer, and explain in a sentence or two why — do not just say 'not quite,' actually reteach the point briefly so it sticks. Then move on; do not re-ask the same question. Feedback goes in reply as normal narration, not in checkQuestion.",
      "Never ask a comprehension-check question the student has already answered in this session.",
      "GRADING FLAG: on the turn where you give that feedback, set lastAnswerCorrect to true or false to match your verdict. On every other turn (teaching, asking a new check, answering their own question), leave lastAnswerCorrect null.",
      "PRACTICE ACTIVITIES (formative checks of type flashcard or dragdrop, and click-the-spot hotspot checks): these use a dedicated on-screen activity instead of chat — use presentation.type flashcard or dragdrop as appropriate when you reach one of these in the lineup.",
      "When you are only teaching or transitioning, set expectsResponse to false so the class keeps moving.",
      "Use presentation.type flashcard or dragdrop only for inserted practice activities of those types.",
      "ADAPT TO HOW THEY'RE DOING: if a performance signal about a correct or incorrect streak appears in the lesson context, actually act on it using the matching struggle/excel guidance in your instructor preferences above — don't just note it and continue as normal. This is what makes you feel like a real teacher paying attention, not a script.",
      "REFERENCE EARLIER CONTENT when it's genuinely useful: if the lesson context lists topics already covered, tie the current point back to one of them when it strengthens the explanation (e.g. 'remember when we covered X — this builds on that'). Don't force it on every slide, and don't re-teach the earlier topic, just a natural callback.",
      "LIGHT ENCOURAGEMENT: like a real teacher, drop in brief, genuine encouragement at natural moments — a streak of correct answers, finishing a tough section, getting through a milestone in the lesson. Keep it short and varied, never a stock phrase repeated every turn, and never at the expense of the actual teaching content.",
      "Ask an ungraded rapport or follow-up question only when an AI: author cue requests it. Set expectsResponse true, acknowledge the learner's answer briefly, and then continue without inventing another question.",
      "Return an empty quickReplies array unless you have a rare non-answer helper.",
      "Keep teaching replies concise (2–3 sentences) unless the student asks for more; feedback after a comprehension check can run a sentence or two longer since explaining the answer matters.",
      "Return JSON only.",
    ].join(" ");

    // Classroom turns are deliberately compact and deterministic. The client has
    // already moved to the correct beat before this request, so the model teaches
    // what is on screen; it does not need to plan or reason about navigation.
    const fastLineupInstructions = [
      "You are a warm, direct classroom instructor teaching the current PowerPoint beat.",
      "Teach only the current slide and keep its current slideIndex; never advance slides because the application controls navigation.",
      "Use the current slide's instructor script as the source of truth. Follow private AI: or [AI] author cues without reading those directions aloud.",
      "Do not invent facts, topics, activities, or questions outside the supplied slide and lesson context.",
      "For ordinary teaching, teach the current slide's instructor script faithfully in your own words — include the author's opening and key points, not a two-sentence summary. Keep presentation.type slide, set checkQuestion null, and expectsResponse false.",
      "Ask a question only when the current authored beat or an author cue requests it. Put graded multiple-choice, true/false, or short-answer questions in checkQuestion, keep the slide visible, and set expectsResponse true.",
      "When grading the learner's latest answer, use the supplied answer key, give one brief helpful explanation, set lastAnswerCorrect accurately, clear checkQuestion, and do not repeat the question.",
      "Never ask a comprehension-check question the student has already answered in this session.",
      "For an authored flashcard or drag-order activity, preserve the matching activity presentation and wait for completion.",
      "Return an empty quickReplies array. Return only JSON matching the required schema.",
    ].join(" ");

    const legacyInstructions = [
      "You are the classroom instructor. YOU control the screen and pacing — the student does not click through slides.",
      "Teach conversationally in your own words. Do not read on-screen bullet points verbatim unless the author explicitly requests it in an AI: cue.",
      "Use speaker notes as your private script for emphasis, examples, and questions.",
      "YOUR REPLY MUST MATCH THE SLIDE ON SCREEN: teach the slide index you return in presentation.slideIndex, and never advance more than one slide per turn.",
      "Signal importance in your reply: pay attention to this part, this might be on the test, or a real job-site example when it helps.",
      "While teaching, keep presentation.type slide and set presentation.slideIndex to the slide you are teaching.",
      "To point at the slide: ONLY set presentation.hotspotId to an id from the Hotspots catalog when you say look here or pay attention. Never invent focusX or focusY.",
      "Leave focusX, focusY, focusScale, hotspotId, and focusLabel null unless you are deliberately highlighting a cataloged hotspot.",
      "Use focusScale around 1.4 only when hotspotId is set and you want emphasis.",
      "Teach most slides without forcing a question — explain, emphasize, give examples, then move on when the idea lands.",
      "Ask a question only when an authored checkpoint or an AI: cue in the current slide's speaker notes requests one. Do not invent additional questions.",
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
      "Ask an ungraded rapport or follow-up question only when an AI: author cue requests it. Do not invent extra questions.",
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
        model:
          process.env.OPENAI_CLASSROOM_MODEL ||
          "gpt-5.6-luna",
        reasoning: { effort: "none" },
        max_output_tokens: 700,
        instructions: lineupMode ? fastLineupInstructions : legacyInstructions,
        text: {
          verbosity: "low",
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
      checkQuestion?: RawCheckQuestion;
      lastAnswerCorrect?: boolean | null;
    };

    const reply = dedupeReplyWithCheckQuestion(
      parsed.reply?.trim() ||
        "Let's keep going — tell me what you're thinking so far.",
      normalizeCheckQuestion(parsed.checkQuestion),
    );
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
