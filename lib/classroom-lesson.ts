import type { ClassroomPlan, ClassroomSlide, PresentationView } from "@/lib/classroom";
import type { AssessmentFrequency, ClassroomBuilderConfig } from "@/lib/classroom-builder";
import { defaultClassroomBuilderConfig } from "@/lib/classroom-builder";
import {
  buildLessonBeatsFromLineup,
  checkpointsFromLineup,
  isLineupPlan,
  lineupSummary,
} from "@/lib/classroom-lineup";
import type { ClassroomQuestion } from "@/lib/classroom-question-types";

export type ClassroomCheckpointHotspot = {
  imageUrl: string;
  targetX: number;
  targetY: number;
  toleranceRadius: number;
};

export type ClassroomCheckpoint = {
  id: string;
  slideIndex: number;
  type:
    | "question"
    | "exercise"
    | "multipleChoice"
    | "trueFalse"
    | "hotspot"
    | "shortAnswer"
    | "scenario"
    | "flashcard"
    | "dragdrop"
    | "video";
  headline: string;
  prompt: string;
  choices?: string[];
  correctChoice?: string;
  correctAnswerBool?: boolean;
  hotspot?: ClassroomCheckpointHotspot;
  sampleAnswer?: string;
  keyPoints?: string[];
  flashcards?: Array<{ front: string; back: string }>;
  dragItems?: string[];
  videoUrl?: string;
};

/** The final assessment/question-bank type. Legacy plans only ever populate multipleChoice entries. */
export type ClassroomAssessmentQuestion = ClassroomQuestion;

export function choicesOfAssessmentQuestion(question: ClassroomQuestion): string[] | undefined {
  if (question.type === "multipleChoice") return question.choices;
  if (question.type === "scenario" && question.responseMode === "multipleChoice") return question.choices;
  return undefined;
}

export type ClassroomLessonBeat =
  | { kind: "welcome" }
  | { kind: "slide"; slideIndex: number }
  | { kind: "checkpoint"; checkpointId: string }
  | { kind: "assessment" }
  | { kind: "finalTest" };

function checkpointInterval(frequency: AssessmentFrequency) {
  switch (frequency) {
    case "rare":
      return 4;
    case "moderate":
      return 2;
    case "frequent":
    case "very-frequent":
      return 1;
    default:
      return 2;
  }
}

function cleanActivityText(value: string) {
  return value
    .replace(/\*\*|__|`/g, "")
    .replace(/^\s*(?:#{1,6}|[-*•])\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeSlideHeading(value: string, slide: ClassroomSlide) {
  const cleaned = cleanActivityText(value);
  const title = cleanActivityText(slide.title);
  return (
    !cleaned ||
    cleaned.toLocaleLowerCase() === title.toLocaleLowerCase() ||
    (cleaned.length < 80 && cleaned === cleaned.toLocaleUpperCase() && /[A-Z]/.test(cleaned))
  );
}

function bestTeachingStatement(slide: ClassroomSlide) {
  const candidates = [
    ...(slide.bullets || []),
    ...slide.bodyText.split(/(?:\n|(?<=[.!?])\s+)/),
  ]
    .map(cleanActivityText)
    .filter((part) => part.length >= 12 && !looksLikeSlideHeading(part, slide));
  return candidates[0]?.slice(0, 160) || "This topic affects how the work should be done safely.";
}

function activityChoices(slide: ClassroomSlide, choices?: string[]) {
  const cleaned = (choices || []).map(cleanActivityText).filter(Boolean);
  if (!cleaned.length) return fallbackChoices(slide);
  if (looksLikeSlideHeading(cleaned[0], slide)) {
    cleaned[0] = bestTeachingStatement(slide);
  }
  return [...new Set(cleaned)];
}

function fallbackChoices(slide: ClassroomSlide) {
  const snippet = bestTeachingStatement(slide);
  return [
    snippet,
    "Something unrelated to this slide",
    "I'm not sure yet",
    "None of the above",
  ];
}

function checkpointActivityType(
  index: number,
  config?: ClassroomBuilderConfig,
): ClassroomCheckpoint["type"] {
  const activities = config?.activities;
  const useFlashcards = activities?.flashCards !== false;
  const useDragDrop = activities?.dragDrop !== false;
  const options: ClassroomCheckpoint["type"][] = ["multipleChoice"];
  if (useFlashcards) options.push("flashcard");
  if (useDragDrop) options.push("dragdrop");
  return options[index % options.length];
}

function flashcardsForSlide(slide: ClassroomSlide) {
  const cards: Array<{ front: string; back: string }> = [];
  if (slide.bullets?.length) {
    for (const bullet of slide.bullets.slice(0, 4)) {
      cards.push({
        front: bullet.slice(0, 80),
        back: slide.bodyText.split(/[.!?]/)[0]?.trim().slice(0, 160) || slide.title,
      });
    }
  }
  if (!cards.length) {
    cards.push({
      front: slide.title,
      back: slide.bodyText.slice(0, 180) || "Key idea from this slide.",
    });
  }
  return cards;
}

function dragItemsForSlide(slide: ClassroomSlide) {
  const items = (slide.bullets || [])
    .map((bullet) => bullet.trim())
    .filter((bullet) => bullet.length > 4)
    .slice(0, 5);
  if (items.length >= 2) return items;
  const fallback = slide.bodyText
    .split(/(?:•|;|\n|(?<=[.!?])\s+)/)
    .map((part) => part.trim())
    .filter((part) => part.length > 8)
    .slice(0, 4);
  return fallback.length >= 2 ? fallback : [slide.title, "Review this slide", "Ask your instructor"];
}

export function buildFallbackCheckpoints(
  slides: ClassroomSlide[],
  config?: ClassroomBuilderConfig,
): ClassroomCheckpoint[] {
  const mergedConfig = defaultClassroomBuilderConfig(config);
  const interval = checkpointInterval(mergedConfig.formative.frequency);
  const checkpoints: ClassroomCheckpoint[] = [];
  let activityIndex = 0;

  slides.forEach((slide, index) => {
    const isLast = index === slides.length - 1;
    if ((index + 1) % interval !== 0 && !isLast) return;

    const activityType = checkpointActivityType(activityIndex, mergedConfig);
    activityIndex += 1;
    const choices = fallbackChoices(slide);

    if (activityType === "flashcard") {
      checkpoints.push({
        id: `checkpoint-${index + 1}`,
        slideIndex: index,
        type: "flashcard",
        headline: isLast ? "Review before we wrap up" : "Quick flash card review",
        prompt: `Flip through these cards about "${slide.title}".`,
        flashcards: flashcardsForSlide(slide),
      });
      return;
    }

    if (activityType === "dragdrop") {
      checkpoints.push({
        id: `checkpoint-${index + 1}`,
        slideIndex: index,
        type: "dragdrop",
        headline: isLast ? "Put the steps in order" : "Sequence check",
        prompt: `Put these ideas from "${slide.title}" in the right order.`,
        dragItems: dragItemsForSlide(slide),
      });
      return;
    }

    checkpoints.push({
      id: `checkpoint-${index + 1}`,
      slideIndex: index,
      type: mergedConfig.formative.frequency === "very-frequent" ? "exercise" : "multipleChoice",
      headline: isLast ? "Quick check before we wrap up" : "Check your understanding",
      prompt: `Which statement best matches "${slide.title}"?`,
      choices,
      correctChoice: choices[0],
    });
  });

  return checkpoints;
}

export function buildFallbackAssessment(
  slides: ClassroomSlide[],
  config?: ClassroomBuilderConfig,
): ClassroomAssessmentQuestion[] {
  const mergedConfig = defaultClassroomBuilderConfig(config);
  const enabledTypes = Object.entries(mergedConfig.summative.types).filter(([, on]) => on);
  if (!enabledTypes.length) return [];

  const questionCount = Math.min(
    6,
    Math.max(3, mergedConfig.knowledge.objectives.filter(Boolean).length || 3),
  );
  const pool = slides.length ? slides : [];
  const questions: ClassroomAssessmentQuestion[] = [];

  for (let i = 0; i < questionCount; i += 1) {
    const slide = pool[i % pool.length];
    if (!slide) break;
    const choices = fallbackChoices(slide);
    questions.push({
      id: `assessment-${i + 1}`,
      type: "multipleChoice",
      prompt: `Final review: ${slide.title}. ${choices[0]}?`,
      choices,
      correctChoice: choices[0],
    });
  }

  return questions;
}

function hasEnabledFinalTest(plan: ClassroomPlan): boolean {
  return Boolean(plan.finalTest?.config.enabled && plan.finalTest.questionBank.length);
}

export function buildLessonBeats(plan: ClassroomPlan): ClassroomLessonBeat[] {
  if (isLineupPlan(plan) && plan.lineup?.length) {
    if (plan.lessonBeats?.length) return plan.lessonBeats;
    return buildLessonBeatsFromLineup(plan.lineup, {
      hasAssessment: Boolean(plan.assessment?.length),
      hasFinalTest: hasEnabledFinalTest(plan),
    });
  }

  const config = defaultClassroomBuilderConfig(plan.config);
  const interval = checkpointInterval(config.formative.frequency);
  const checkpoints =
    plan.checkpoints ||
    (plan.lineup?.length ? checkpointsFromLineup(plan.lineup) : buildFallbackCheckpoints(plan.slides, config));
  const checkpointBySlide = new Map(
    checkpoints.map((checkpoint) => [checkpoint.slideIndex, checkpoint]),
  );

  const beats: ClassroomLessonBeat[] = [{ kind: "welcome" }];
  plan.slides.forEach((slide, index) => {
    beats.push({ kind: "slide", slideIndex: index });
    const shouldCheckpoint =
      Boolean(checkpointBySlide.get(index)) &&
      ((index + 1) % interval === 0 || index === plan.slides.length - 1);
    const checkpoint = checkpointBySlide.get(index);
    if (shouldCheckpoint && checkpoint) {
      beats.push({ kind: "checkpoint", checkpointId: checkpoint.id });
    }
  });

  if (hasEnabledFinalTest(plan)) {
    beats.push({ kind: "finalTest" });
  } else {
    const assessment = plan.assessment || buildFallbackAssessment(plan.slides, config);
    if (assessment.length) {
      beats.push({ kind: "assessment" });
    }
  }

  return beats;
}

export function beatIndexForSlide(
  beats: ClassroomLessonBeat[],
  slideIndex: number,
): number {
  return beats.findIndex(
    (beat) => beat.kind === "slide" && beat.slideIndex === slideIndex,
  );
}

export function navLabelForBeat(beat: ClassroomLessonBeat, plan: ClassroomPlan): string {
  switch (beat.kind) {
    case "welcome":
      return "Introduction";
    case "slide": {
      const slide = plan.slides[beat.slideIndex];
      return slide?.title || `Section ${beat.slideIndex + 1}`;
    }
    case "checkpoint": {
      const checkpoint = plan.checkpoints?.find((item) => item.id === beat.checkpointId);
      if (!checkpoint) return "Activity";
      if (checkpoint.type === "flashcard") return "Flash cards";
      if (checkpoint.type === "dragdrop") return "Drag & drop";
      if (checkpoint.type === "video") return checkpoint.headline || "Video";
      if (checkpoint.type === "exercise") return "Try this";
      return checkpoint.headline || "Quick check";
    }
    case "assessment":
      return "Final assessment";
    case "finalTest":
      return "Final test";
    default:
      return "Lesson";
  }
}

export function navShortLabelForBeat(beat: ClassroomLessonBeat, plan: ClassroomPlan): string {
  switch (beat.kind) {
    case "welcome":
      return "Intro";
    case "slide":
      return String(beat.slideIndex + 1);
    case "checkpoint": {
      const checkpoint = plan.checkpoints?.find((item) => item.id === beat.checkpointId);
      if (checkpoint?.type === "flashcard") return "Cards";
      if (checkpoint?.type === "dragdrop") return "Order";
      if (checkpoint?.type === "video") return "Video";
      return "Quiz";
    }
    case "assessment":
      return "Test";
    case "finalTest":
      return "Final";
    default:
      return "•";
  }
}

export type ClassroomNavBeatKind =
  | ClassroomLessonBeat["kind"]
  | "checkpoint-flashcard"
  | "checkpoint-dragdrop"
  | "checkpoint-video"
  | "checkpoint-question";

export function navBeatKind(
  beat: ClassroomLessonBeat,
  plan: ClassroomPlan,
): ClassroomNavBeatKind {
  if (beat.kind !== "checkpoint") return beat.kind;
  const checkpoint = plan.checkpoints?.find((item) => item.id === beat.checkpointId);
  if (checkpoint?.type === "flashcard") return "checkpoint-flashcard";
  if (checkpoint?.type === "dragdrop") return "checkpoint-dragdrop";
  if (checkpoint?.type === "video") return "checkpoint-video";
  return "checkpoint-question";
}

export function presentationForBeat(
  plan: ClassroomPlan,
  beat: ClassroomLessonBeat,
  assessmentIndex = 0,
): PresentationView {
  switch (beat.kind) {
    case "welcome":
      return {
        type: "welcome",
        headline: plan.title,
        body: plan.opening,
      };
    case "slide": {
      const slide = plan.slides[beat.slideIndex];
      return {
        type: "slide",
        slideIndex: beat.slideIndex,
        headline: slide?.title,
      };
    }
    case "checkpoint": {
      const checkpoint = plan.checkpoints?.find((item) => item.id === beat.checkpointId);
      if (!checkpoint) {
        return { type: "slide", slideIndex: 0 };
      }
      if (checkpoint.type === "flashcard") {
        return {
          type: "flashcard",
          headline: checkpoint.headline,
          prompt: checkpoint.prompt,
          flashcards: checkpoint.flashcards || [],
        };
      }
      if (checkpoint.type === "dragdrop") {
        return {
          type: "dragdrop",
          headline: checkpoint.headline,
          prompt: checkpoint.prompt,
          dragItems: checkpoint.dragItems || [],
        };
      }
      if (checkpoint.type === "video" && checkpoint.videoUrl) {
        return {
          type: "video",
          headline: checkpoint.headline,
          prompt: checkpoint.prompt,
          videoUrl: checkpoint.videoUrl,
        };
      }
      if (checkpoint.type === "hotspot" && checkpoint.hotspot) {
        return {
          type: "hotspot",
          headline: checkpoint.headline,
          prompt: checkpoint.prompt,
          imageUrl: checkpoint.hotspot.imageUrl,
          targetX: checkpoint.hotspot.targetX,
          targetY: checkpoint.hotspot.targetY,
          toleranceRadius: checkpoint.hotspot.toleranceRadius,
        };
      }
      return {
        type: checkpoint.type === "exercise" ? "exercise" : "question",
        headline: checkpoint.headline,
        prompt: checkpoint.prompt,
        choices: activityChoices(
          plan.slides[checkpoint.slideIndex] || plan.slides[0],
          checkpoint.choices,
        ),
      };
    }
    case "assessment": {
      const questions =
        plan.assessment || buildFallbackAssessment(plan.slides, plan.config);
      const question = questions[assessmentIndex] || questions[0];
      if (!question) {
        return { type: "welcome", headline: plan.title, body: plan.opening };
      }
      return {
        type: "assessment",
        headline: "Final assessment",
        prompt: question.prompt,
        choices: activityChoices(
          plan.slides.find((slide) => question.prompt.includes(slide.title)) || plan.slides[0],
          choicesOfAssessmentQuestion(question),
        ),
        questionIndex: assessmentIndex,
        questionCount: questions.length,
      };
    }
    default:
      return { type: "welcome", headline: plan.title, body: plan.opening };
  }
}

export function lessonBeatSummary(plan: ClassroomPlan) {
  if (isLineupPlan(plan)) {
    const beats = plan.lessonBeats || buildLessonBeats(plan);
    return [lineupSummary(plan), `Lesson beats: ${beats.length} total.`].join("\n\n");
  }

  const beats = plan.lessonBeats || buildLessonBeats(plan);
  const checkpoints = plan.checkpoints || buildFallbackCheckpoints(plan.slides, plan.config);
  const assessment = plan.assessment || buildFallbackAssessment(plan.slides, plan.config);
  return [
    `Lesson beats: ${beats.length} total (${beats.filter((beat) => beat.kind === "slide").length} slides, ${beats.filter((beat) => beat.kind === "checkpoint").length} checkpoints${assessment.length ? ", final assessment" : ""}).`,
    checkpoints.length
      ? `Checkpoints:\n${checkpoints
          .map(
            (checkpoint) =>
              `- ${checkpoint.id} after slide ${checkpoint.slideIndex + 1}: ${checkpoint.prompt}`,
          )
          .join("\n")}`
      : "No checkpoints configured.",
    assessment.length
      ? `Final assessment (${assessment.length} questions, passing score ${plan.config?.summative.passingScore ?? 80}%):\n${assessment
          .map((question) => `- ${question.prompt}`)
          .join("\n")}`
      : "No final assessment configured.",
    "Use presentation.type question, exercise, or assessment during checkpoints. Advance slideIndex when moving to the next teaching slide.",
  ].join("\n\n");
}
