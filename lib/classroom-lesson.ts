import type { ClassroomPlan, ClassroomSlide, PresentationView } from "@/lib/classroom";
import type { AssessmentFrequency, ClassroomBuilderConfig } from "@/lib/classroom-builder";
import { defaultClassroomBuilderConfig } from "@/lib/classroom-builder";

export type ClassroomCheckpoint = {
  id: string;
  slideIndex: number;
  type: "question" | "exercise" | "multipleChoice";
  headline: string;
  prompt: string;
  choices: string[];
  correctChoice?: string;
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

export function buildFallbackCheckpoints(
  slides: ClassroomSlide[],
  config?: ClassroomBuilderConfig,
): ClassroomCheckpoint[] {
  const mergedConfig = defaultClassroomBuilderConfig(config);
  const interval = checkpointInterval(mergedConfig.formative.frequency);
  const checkpoints: ClassroomCheckpoint[] = [];

  slides.forEach((slide, index) => {
    const isLast = index === slides.length - 1;
    if ((index + 1) % interval !== 0 && !isLast) return;

    const choices = fallbackChoices(slide);
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
