import type { ClassroomPlan, ClassroomSlide } from "@/lib/classroom";
import type { ClassroomBuilderConfig } from "@/lib/classroom-builder";
import type {
  ClassroomAssessmentQuestion,
  ClassroomCheckpoint,
  ClassroomCheckpointHotspot,
  ClassroomLessonBeat,
} from "@/lib/classroom-lesson";
import { classroomChapterSlideAssetPath } from "@/lib/classroom-chapters";
import {
  resolveHotspotImageUrl,
  type ClassroomFinalTest,
  type ClassroomQuestion,
  type QuestionType,
} from "@/lib/classroom-question-types";

/** Visual transition used when a slide enters the stage. */
export type SlideTransition = "none" | "fade" | "slide-left" | "slide-up" | "zoom" | "flip";

export const SLIDE_TRANSITIONS: Array<{ id: SlideTransition; label: string }> = [
  { id: "fade", label: "Fade" },
  { id: "slide-left", label: "Slide from right" },
  { id: "slide-up", label: "Slide up" },
  { id: "zoom", label: "Zoom in" },
  { id: "flip", label: "Flip" },
  { id: "none", label: "None (instant)" },
];

/** A content slide: slide image + author-written teaching instructions for the AI. */
export type LineupContentSlide = {
  kind: "content";
  id: string;
  title: string;
  teachingContent: string;
  imageUrl?: string;
  /** Transition used when this slide appears. */
  transition?: SlideTransition;
  /** Populated after upload — index into plan.slides */
  slideIndex?: number;
};

/** A formative assessment inserted anywhere in the lesson lineup. */
export type LineupFormative = {
  kind: "formative";
  id: string;
  headline: string;
  prompt: string;
  type:
    | "multipleChoice"
    | "trueFalse"
    | "hotspot"
    | "shortAnswer"
    | "scenario"
    | "exercise"
    | "flashcard"
    | "dragdrop";
  choices?: string[];
  correctChoice?: string;
  correctAnswerBool?: boolean;
  hotspot?: ClassroomCheckpointHotspot;
  sampleAnswer?: string;
  keyPoints?: string[];
  flashcards?: Array<{ front: string; back: string }>;
  dragItems?: string[];
};

/** An activity slide inserted anywhere in the lesson lineup. */
export type LineupActivity = {
  kind: "activity";
  id: string;
  headline: string;
  prompt: string;
  activityType: "discussion" | "scenario" | "reflection" | "exercise";
  choices?: string[];
};

/** A manually inserted video moment between teaching slides. */
export type LineupVideo = {
  kind: "video";
  id: string;
  title: string;
  prompt: string;
  videoUrl: string;
};

export type LessonLineupItem =
  | LineupContentSlide
  | LineupFormative
  | LineupActivity
  | LineupVideo;

export function createLineupId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

export function resolveLineupAssetUrl(value: string, slug: string) {
  const prefix = "asset:";
  if (!value.startsWith(prefix)) return value;
  const path = value.slice(prefix.length).split("/").map(encodeURIComponent).join("/");
  return `/api/classroom/${encodeURIComponent(slug)}/asset/${path}`;
}

export function emptyContentSlide(title = "New slide"): LineupContentSlide {
  return {
    kind: "content",
    id: createLineupId("content"),
    title,
    teachingContent: "",
  };
}

export function emptyFormative(): LineupFormative {
  return {
    kind: "formative",
    id: createLineupId("formative"),
    headline: "Check your understanding",
    prompt: "Which statement best matches what we just covered?",
    type: "multipleChoice",
    choices: ["", "", "", ""],
    correctChoice: "",
  };
}

export function emptyActivity(): LineupActivity {
  return {
    kind: "activity",
    id: createLineupId("activity"),
    headline: "Let's practice",
    prompt: "Think about how you would apply this on the job.",
    activityType: "discussion",
  };
}

export function emptyVideo(): LineupVideo {
  const id = createLineupId("video");
  return {
    kind: "video",
    id,
    title: "Video demonstration",
    prompt: "Watch this video, then continue with your instructor.",
    videoUrl: `asset:classroom/media/${id}`,
  };
}

function toFormativeType(type: QuestionType): LineupFormative["type"] {
  return type === "dragDrop" ? "dragdrop" : type;
}

/** Converts a generated/accepted ClassroomQuestion into a lineup formative-check item. */
export function formativeFromQuestion(question: ClassroomQuestion, headline: string): LineupFormative {
  const formative: LineupFormative = {
    kind: "formative",
    id: createLineupId("formative"),
    headline,
    prompt: question.prompt,
    type: toFormativeType(question.type),
  };

  switch (question.type) {
    case "multipleChoice":
      formative.choices = question.choices;
      formative.correctChoice = question.correctChoice;
      break;
    case "trueFalse":
      formative.correctAnswerBool = question.correctAnswer;
      break;
    case "dragDrop":
      formative.dragItems = question.dragItems;
      break;
    case "flashcard":
      formative.flashcards = [{ front: question.front, back: question.back }];
      break;
    case "shortAnswer":
      formative.sampleAnswer = question.sampleAnswer;
      formative.keyPoints = question.keyPoints;
      break;
    case "scenario":
      if (question.responseMode === "multipleChoice") {
        formative.choices = question.choices;
        formative.correctChoice = question.correctChoice;
      } else {
        formative.sampleAnswer = question.sampleAnswer;
        formative.keyPoints = question.keyPoints;
      }
      break;
    case "hotspot":
      formative.hotspot = {
        imageUrl: question.imageUrl,
        targetX: question.targetX,
        targetY: question.targetY,
        toleranceRadius: question.toleranceRadius,
      };
      break;
  }

  return formative;
}

export function isLineupPlan(plan: ClassroomPlan): boolean {
  return Boolean(plan.lineup?.length);
}

export function slidesFromLineup(
  lineup: LessonLineupItem[],
  slug: string,
  chapterPosition = 1,
): ClassroomSlide[] {
  const slides: ClassroomSlide[] = [];
  let contentIndex = 0;

  for (const item of lineup) {
    if (item.kind !== "content") continue;
    slides.push({
      index: contentIndex,
      title: item.title || `Slide ${contentIndex + 1}`,
      bodyText: "",
      speakerNotes: item.teachingContent,
      transition: item.transition,
      imageUrl: item.imageUrl || `/api/classroom/${slug}/slides/${contentIndex}`,
    });
    contentIndex += 1;
  }

  return slides.map((slide, index) => ({
    ...slide,
    imageUrl:
      slide.imageUrl?.startsWith("/api/")
        ? slide.imageUrl
        : `/api/classroom/${slug}/slides/${index}`,
  }));
}

export function checkpointsFromLineup(lineup: LessonLineupItem[]): ClassroomCheckpoint[] {
  const checkpoints: ClassroomCheckpoint[] = [];

  for (const item of lineup) {
    if (item.kind === "video") {
      checkpoints.push({
        id: item.id,
        slideIndex: lastContentSlideIndex(lineup, item),
        type: "video",
        headline: item.title,
        prompt: item.prompt,
        videoUrl: item.videoUrl,
      });
      continue;
    }

    if (item.kind === "formative") {
      checkpoints.push({
        id: item.id,
        slideIndex: lastContentSlideIndex(lineup, item),
        type: item.type,
        headline: item.headline,
        prompt: item.prompt,
        choices: item.choices?.filter(Boolean),
        correctChoice: item.correctChoice,
        correctAnswerBool: item.correctAnswerBool,
        hotspot: item.hotspot,
        sampleAnswer: item.sampleAnswer,
        keyPoints: item.keyPoints,
        flashcards: item.flashcards,
        dragItems: item.dragItems,
      });
      continue;
    }

    if (item.kind === "activity") {
      checkpoints.push({
        id: item.id,
        slideIndex: lastContentSlideIndex(lineup, item),
        type: item.activityType === "exercise" ? "exercise" : "question",
        headline: item.headline,
        prompt: item.prompt,
        choices: item.choices?.filter(Boolean),
      });
    }
  }

  return checkpoints;
}

function lastContentSlideIndex(lineup: LessonLineupItem[], beforeItem: LessonLineupItem): number {
  let slideIndex = 0;
  let lastIndex = 0;

  for (const item of lineup) {
    if (item === beforeItem) break;
    if (item.kind === "content") {
      lastIndex = slideIndex;
      slideIndex += 1;
    }
  }

  return lastIndex;
}

export function buildLessonBeatsFromLineup(
  lineup: LessonLineupItem[],
  options?: { hasAssessment?: boolean; hasFinalTest?: boolean },
): ClassroomLessonBeat[] {
  const beats: ClassroomLessonBeat[] = [{ kind: "welcome" }];
  let slideIndex = 0;

  for (const item of lineup) {
    if (item.kind === "content") {
      beats.push({ kind: "slide", slideIndex });
      slideIndex += 1;
      continue;
    }

    beats.push({ kind: "checkpoint", checkpointId: item.id });
  }

  if (options?.hasFinalTest) {
    beats.push({ kind: "finalTest" });
  } else if (options?.hasAssessment) {
    beats.push({ kind: "assessment" });
  }

  return beats;
}

export function attachSlideIndicesToLineup(lineup: LessonLineupItem[]): LessonLineupItem[] {
  let slideIndex = 0;

  return lineup.map((item) => {
    if (item.kind !== "content") return item;
    const next = { ...item, slideIndex };
    slideIndex += 1;
    return next;
  });
}

export function buildClassroomPlanFromLineup(
  lineup: LessonLineupItem[],
  title: string,
  slug: string,
  config?: ClassroomBuilderConfig,
  options?: {
    description?: string;
    assessment?: ClassroomAssessmentQuestion[];
    finalTest?: ClassroomFinalTest;
  },
): ClassroomPlan {
  const attachedLineup = attachSlideIndicesToLineup(lineup);
  const slides = slidesFromLineup(attachedLineup, slug);
  const checkpoints = checkpointsFromLineup(attachedLineup).map((checkpoint) =>
    checkpoint.videoUrl
      ? { ...checkpoint, videoUrl: resolveLineupAssetUrl(checkpoint.videoUrl, slug) }
      : checkpoint.hotspot
      ? {
          ...checkpoint,
          hotspot: {
            ...checkpoint.hotspot,
            imageUrl: resolveLineupAssetUrl(
              resolveHotspotImageUrl(checkpoint.hotspot.imageUrl, slug),
              slug,
            ),
          },
        }
      : checkpoint,
  );
  const finalTest = options?.finalTest
    ? {
        ...options.finalTest,
        questionBank: options.finalTest.questionBank.map((question) =>
          question.type === "hotspot"
            ? { ...question, imageUrl: resolveHotspotImageUrl(question.imageUrl, slug) }
            : question,
        ),
      }
    : undefined;
  const objectives =
    config?.knowledge.objectives.filter(Boolean) ||
    attachedLineup
      .filter((item): item is LineupContentSlide => item.kind === "content")
      .map((item) => item.title)
      .filter(Boolean)
      .slice(0, 5);

  const plan: ClassroomPlan = {
    type: "classroom",
    title: config?.knowledge.courseName || title,
    opening:
      options?.description ||
      config?.knowledge.description ||
      "Welcome. I'll teach from your slides — zoomed views and highlights are already built into the images you prepared.",
    objectives: objectives.length ? objectives : ["Understand the lesson material"],
    topics: slides.map((slide, index) => ({
      id: `topic-${index + 1}`,
      title: slide.title,
      slideStart: index,
      slideEnd: index,
    })),
    slides,
    lineup: attachedLineup,
    checkpoints,
    assessment: options?.assessment || [],
    finalTest,
    config,
    lessonBeats: buildLessonBeatsFromLineup(attachedLineup, {
      hasAssessment: Boolean(options?.assessment?.length),
      hasFinalTest: Boolean(finalTest?.config.enabled && finalTest.questionBank.length),
    }),
  };

  return plan;
}

export function lineupItemLabel(item: LessonLineupItem): string {
  switch (item.kind) {
    case "content":
      return item.title || "Content slide";
    case "formative":
      return item.headline || "Formative check";
    case "activity":
      return item.headline || "Activity";
    case "video":
      return item.title || "Video";
    default:
      return "Lesson item";
  }
}

export function lineupSummary(plan: ClassroomPlan): string {
  if (!plan.lineup?.length) return "";

  const contentCount = plan.lineup.filter((item) => item.kind === "content").length;
  const formativeCount = plan.lineup.filter((item) => item.kind === "formative").length;
  const activityCount = plan.lineup.filter((item) => item.kind === "activity").length;
  const videoCount = plan.lineup.filter((item) => item.kind === "video").length;

  // Titles only, not full teaching notes — the current/next slide's full script is sent
  // separately per turn (see chat/route.ts), and resending every slide's full notes on
  // every single turn was a large, unnecessary token cost that scaled with course length.
  const slideTitles = plan.lineup
    .filter((item): item is LineupContentSlide => item.kind === "content")
    .map((item, index) => `${index + 1}. ${item.title}`)
    .join(", ");

  const assessments = plan.lineup
    .filter(
      (item): item is LineupFormative | LineupActivity | LineupVideo =>
        item.kind !== "content",
    )
    .map((item) =>
      item.kind === "formative"
        ? `- Formative check (${item.type}): "${item.headline}" — ${item.prompt}${formativeAnswerKeyText(item)}`
        : item.kind === "video"
          ? `- Video: "${item.title}" — ${item.prompt}`
          : `- Activity: "${item.headline}" — ${item.prompt}`,
    )
    .join("\n");

  return [
    `Lesson lineup: ${contentCount} content slides, ${videoCount} videos, ${formativeCount} formative checks, ${activityCount} activities (in author-defined order).`,
    "Slides are shown exactly as uploaded. Zoomed or circled views are separate slides in the deck — do not zoom or circle on screen.",
    `All slide titles in order: ${slideTitles}`,
    assessments ? `Inserted checks and activities:\n${assessments}` : "No formative checks or activities in the lineup.",
  ].join("\n\n");
}

/**
 * Cheap "what have we already taught" recap — titles only, built from the slides the
 * client has actually presented so far — so the AI can make natural callbacks to earlier
 * content ("remember when we covered...") without resending every slide's full notes.
 */
export function coveredTopicsSummary(
  plan: ClassroomPlan,
  taughtSlideIndices: number[],
  excludeIndices: number[],
): string {
  const covered = [...new Set(taughtSlideIndices)]
    .filter((index) => !excludeIndices.includes(index))
    .sort((a, b) => a - b)
    .map((index) => plan.slides[index]?.title)
    .filter((title): title is string => Boolean(title));

  if (!covered.length) return "";
  return `Topics already covered earlier in this class (titles only — refer back naturally when it strengthens a point, don't re-teach them): ${covered.join(", ")}.`;
}

/**
 * The true answer key for a formative check, appended to its lineup summary line so the AI
 * asks the check and grades the student's reply against the actual authored answer instead
 * of improvising both the question and the correctness judgment.
 */
function formativeAnswerKeyText(item: LineupFormative): string {
  switch (item.type) {
    case "multipleChoice": {
      const choices = (item.choices || []).filter(Boolean);
      if (!choices.length) return "";
      return ` [Options: ${choices.join(" / ")}. Correct answer: ${item.correctChoice || choices[0]}.]`;
    }
    case "trueFalse":
      return ` [Correct answer: ${item.correctAnswerBool ? "True" : "False"}.]`;
    case "shortAnswer":
      return item.sampleAnswer
        ? ` [Reference answer: ${item.sampleAnswer}${item.keyPoints?.length ? ` Key points: ${item.keyPoints.join(", ")}.` : ""}]`
        : "";
    case "scenario":
      if (item.choices?.length) {
        return ` [Options: ${item.choices.join(" / ")}. Correct answer: ${item.correctChoice || item.choices[0]}.]`;
      }
      return item.sampleAnswer ? ` [Reference answer: ${item.sampleAnswer}]` : "";
    default:
      return "";
  }
}

export function slideAssetPathForLineupIndex(slideIndex: number, chapterPosition = 1) {
  return classroomChapterSlideAssetPath(chapterPosition, slideIndex);
}
