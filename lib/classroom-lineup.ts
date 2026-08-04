import type { ClassroomPlan, ClassroomSlide } from "@/lib/classroom";
import type { ClassroomBuilderConfig } from "@/lib/classroom-builder";
import type {
  ClassroomAssessmentQuestion,
  ClassroomCheckpoint,
  ClassroomLessonBeat,
} from "@/lib/classroom-lesson";
import { classroomChapterSlideAssetPath } from "@/lib/classroom-chapters";

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
  type: "multipleChoice" | "exercise" | "flashcard" | "dragdrop";
  choices?: string[];
  correctChoice?: string;
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

export type LessonLineupItem = LineupContentSlide | LineupFormative | LineupActivity;

export function createLineupId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
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
    if (item.kind === "formative") {
      checkpoints.push({
        id: item.id,
        slideIndex: lastContentSlideIndex(lineup, item),
        type: item.type,
        headline: item.headline,
        prompt: item.prompt,
        choices: item.choices?.filter(Boolean),
        correctChoice: item.correctChoice,
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
  options?: { hasAssessment?: boolean },
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

  if (options?.hasAssessment) {
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
  },
): ClassroomPlan {
  const attachedLineup = attachSlideIndicesToLineup(lineup);
  const slides = slidesFromLineup(attachedLineup, slug);
  const checkpoints = checkpointsFromLineup(attachedLineup);
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
    config,
    lessonBeats: buildLessonBeatsFromLineup(attachedLineup, {
      hasAssessment: Boolean(options?.assessment?.length),
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
    default:
      return "Lesson item";
  }
}

export function lineupSummary(plan: ClassroomPlan): string {
  if (!plan.lineup?.length) return "";

  const contentCount = plan.lineup.filter((item) => item.kind === "content").length;
  const formativeCount = plan.lineup.filter((item) => item.kind === "formative").length;
  const activityCount = plan.lineup.filter((item) => item.kind === "activity").length;

  const teachingNotes = plan.lineup
    .filter((item): item is LineupContentSlide => item.kind === "content")
    .map(
      (item, index) =>
        `Content slide ${index + 1} (${item.title}):\n${item.teachingContent || "(No teaching notes — teach from the slide image.)"}`,
    )
    .join("\n\n");

  const assessments = plan.lineup
    .filter((item): item is LineupFormative | LineupActivity => item.kind !== "content")
    .map((item) => `- ${item.kind === "formative" ? "Formative" : "Activity"}: ${item.headline} — ${item.prompt}`)
    .join("\n");

  return [
    `Lesson lineup: ${contentCount} content slides, ${formativeCount} formative checks, ${activityCount} activities (in author-defined order).`,
    "Slides are shown exactly as uploaded. Zoomed or circled views are separate slides in the deck — do not zoom or circle on screen.",
    `Teaching scripts by slide:\n${teachingNotes}`,
    assessments ? `Inserted checks and activities:\n${assessments}` : "No formative checks or activities in the lineup.",
  ].join("\n\n");
}

export function slideAssetPathForLineupIndex(slideIndex: number, chapterPosition = 1) {
  return classroomChapterSlideAssetPath(chapterPosition, slideIndex);
}
