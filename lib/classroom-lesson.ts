import type { ClassroomPlan, ClassroomSlide, PresentationView } from "@/lib/classroom";
import type { AssessmentFrequency, ClassroomBuilderConfig } from "@/lib/classroom-builder";
import { defaultClassroomBuilderConfig } from "@/lib/classroom-builder";

export type ClassroomCheckpoint = {
  id: string;
  slideIndex: number;
  type: "question" | "exercise" | "multipleChoice" | "flashcard" | "dragdrop";
  headline: string;
  prompt: string;
  choices?: string[];
  correctChoice?: string;
  flashcards?: Array<{ front: string; back: string }>;
  dragItems?: string[];
};

export type ClassroomAssessmentQuestion = {
  id: string;
  prompt: string;
  choices: string[];
  correctChoice: string;
};

export type ClassroomLessonBeat =
  | { kind: "welcome" }
  | { kind: "slide"; slideIndex: number }
  | { kind: "checkpoint"; checkpointId: string }
  | { kind: "assessment" };

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

function fallbackChoices(slide: ClassroomSlide) {
  const snippet = slide.bodyText.split(/[.!?]/)[0]?.trim() || slide.title;
  return [
    snippet.slice(0, 72),
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
      prompt: `Final review: ${slide.title}. ${choices[0]}?`,
      choices,
      correctChoice: choices[0],
    });
  }

  return questions;
}

export function buildLessonBeats(plan: ClassroomPlan): ClassroomLessonBeat[] {
  const config = defaultClassroomBuilderConfig(plan.config);
  const interval = checkpointInterval(config.formative.frequency);
  const checkpoints = plan.checkpoints || buildFallbackCheckpoints(plan.slides, config);
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

  const assessment = plan.assessment || buildFallbackAssessment(plan.slides, config);
  if (assessment.length) {
    beats.push({ kind: "assessment" });
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
      return slide?.title || `Slide ${beat.slideIndex + 1}`;
    }
    case "checkpoint": {
      const checkpoint = plan.checkpoints?.find((item) => item.id === beat.checkpointId);
      if (!checkpoint) return "Activity";
      if (checkpoint.type === "flashcard") return "Flash cards";
      if (checkpoint.type === "dragdrop") return "Drag & drop";
      if (checkpoint.type === "exercise") return "Try this";
      return checkpoint.headline || "Quick check";
    }
    case "assessment":
      return "Final assessment";
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
      return "Quiz";
    }
    case "assessment":
      return "Test";
    default:
      return "•";
  }
}

export type ClassroomNavBeatKind = ClassroomLessonBeat["kind"] | "checkpoint-flashcard" | "checkpoint-dragdrop" | "checkpoint-question";

export function navBeatKind(
  beat: ClassroomLessonBeat,
  plan: ClassroomPlan,
): ClassroomNavBeatKind {
  if (beat.kind !== "checkpoint") return beat.kind;
  const checkpoint = plan.checkpoints?.find((item) => item.id === beat.checkpointId);
  if (checkpoint?.type === "flashcard") return "checkpoint-flashcard";
  if (checkpoint?.type === "dragdrop") return "checkpoint-dragdrop";
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
      return {
        type: checkpoint.type === "exercise" ? "exercise" : "question",
        headline: checkpoint.headline,
        prompt: checkpoint.prompt,
        choices: checkpoint.choices,
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
        choices: question.choices,
        questionIndex: assessmentIndex,
        questionCount: questions.length,
      };
    }
    default:
      return { type: "welcome", headline: plan.title, body: plan.opening };
  }
}

export function lessonBeatSummary(plan: ClassroomPlan) {
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
