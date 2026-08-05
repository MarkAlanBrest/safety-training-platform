/** The seven question types AI generation and the instructor builder can produce. */
export type QuestionType =
  | "multipleChoice"
  | "trueFalse"
  | "dragDrop"
  | "hotspot"
  | "flashcard"
  | "shortAnswer"
  | "scenario";

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  multipleChoice: "Multiple Choice",
  trueFalse: "True / False",
  dragDrop: "Drag & Drop",
  hotspot: "Click-the-Spot",
  flashcard: "Flash Card",
  shortAnswer: "Short Answer",
  scenario: "Scenario",
};

export const QUESTION_TYPES: QuestionType[] = [
  "multipleChoice",
  "trueFalse",
  "dragDrop",
  "hotspot",
  "flashcard",
  "shortAnswer",
  "scenario",
];

/** Default click tolerance for a hotspot question, as a percent of the image's diagonal. */
export const DEFAULT_HOTSPOT_TOLERANCE = 8;

type BaseQuestion = {
  id: string;
  type: QuestionType;
  prompt: string;
  explanation?: string;
};

export type MultipleChoiceQuestion = BaseQuestion & {
  type: "multipleChoice";
  choices: string[];
  correctChoice: string;
};

export type TrueFalseQuestion = BaseQuestion & {
  type: "trueFalse";
  correctAnswer: boolean;
};

/** `dragItems` are stored in correct order. */
export type DragDropQuestion = BaseQuestion & {
  type: "dragDrop";
  dragItems: string[];
};

export type HotspotQuestion = BaseQuestion & {
  type: "hotspot";
  imageUrl: string;
  targetX: number;
  targetY: number;
  toleranceRadius: number;
};

export type FlashcardQuestion = BaseQuestion & {
  type: "flashcard";
  front: string;
  back: string;
};

export type ShortAnswerQuestion = BaseQuestion & {
  type: "shortAnswer";
  sampleAnswer: string;
  keyPoints?: string[];
};

export type ScenarioQuestion = BaseQuestion &
  (
    | { type: "scenario"; scenarioText: string; responseMode: "multipleChoice"; choices: string[]; correctChoice: string }
    | { type: "scenario"; scenarioText: string; responseMode: "shortAnswer"; sampleAnswer: string; keyPoints?: string[] }
  );

export type ClassroomQuestion =
  | MultipleChoiceQuestion
  | TrueFalseQuestion
  | DragDropQuestion
  | HotspotQuestion
  | FlashcardQuestion
  | ShortAnswerQuestion
  | ScenarioQuestion;

export type ClassroomFinalTestConfig = {
  enabled: boolean;
  questionCount: number;
  includedTypes: QuestionType[];
  randomizeQuestions: boolean;
  randomizeChoiceOrder: boolean;
  passingScore: number;
  /** 0 means unlimited. */
  attemptsAllowed: number;
  /** null means untimed. */
  timeLimitMinutes: number | null;
  certificateOnPass: boolean;
  aiReviewAfterSubmission: boolean;
};

export type ClassroomFinalTest = {
  config: ClassroomFinalTestConfig;
  questionBank: ClassroomQuestion[];
};

/**
 * A generated formative check, kept as a plain ClassroomQuestion (shared shape with
 * bank questions, so the review UI can use one editor) plus placement metadata.
 * Converted to a LineupFormative only once the instructor accepts it.
 */
export type GeneratedFormative = {
  slideIndex: number;
  headline: string;
  question: ClassroomQuestion;
};

export function defaultFinalTestConfig(
  overrides?: Partial<ClassroomFinalTestConfig>,
): ClassroomFinalTestConfig {
  return {
    enabled: false,
    questionCount: 10,
    includedTypes: ["multipleChoice", "trueFalse"],
    randomizeQuestions: true,
    randomizeChoiceOrder: true,
    passingScore: 80,
    attemptsAllowed: 2,
    timeLimitMinutes: null,
    certificateOnPass: true,
    aiReviewAfterSubmission: true,
    ...overrides,
  };
}

function createQuestionId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

/**
 * Coerces a raw/legacy question object into a typed ClassroomQuestion.
 * Legacy assessment entries are `{id, prompt, choices, correctChoice}` with no
 * `type` field — those are treated as multipleChoice.
 */
export function normalizeAssessmentQuestion(raw: unknown): ClassroomQuestion | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const prompt = typeof value.prompt === "string" ? value.prompt.trim() : "";
  if (!prompt) return null;

  const id = typeof value.id === "string" && value.id ? value.id : createQuestionId("question");
  const type = (typeof value.type === "string" ? value.type : "multipleChoice") as QuestionType;
  const explanation = typeof value.explanation === "string" ? value.explanation : undefined;

  switch (type) {
    case "trueFalse": {
      if (typeof value.correctAnswer !== "boolean") return null;
      return { id, type, prompt, explanation, correctAnswer: value.correctAnswer };
    }
    case "dragDrop": {
      const dragItems = Array.isArray(value.dragItems)
        ? value.dragItems.filter((item): item is string => typeof item === "string" && Boolean(item))
        : [];
      if (dragItems.length < 2) return null;
      return { id, type, prompt, explanation, dragItems };
    }
    case "hotspot": {
      const imageUrl = typeof value.imageUrl === "string" ? value.imageUrl : "";
      const targetX = typeof value.targetX === "number" ? value.targetX : NaN;
      const targetY = typeof value.targetY === "number" ? value.targetY : NaN;
      if (!imageUrl || Number.isNaN(targetX) || Number.isNaN(targetY)) return null;
      const toleranceRadius =
        typeof value.toleranceRadius === "number" ? value.toleranceRadius : DEFAULT_HOTSPOT_TOLERANCE;
      return { id, type, prompt, explanation, imageUrl, targetX, targetY, toleranceRadius };
    }
    case "flashcard": {
      const front = typeof value.front === "string" ? value.front : "";
      const back = typeof value.back === "string" ? value.back : "";
      if (!front || !back) return null;
      return { id, type, prompt, explanation, front, back };
    }
    case "shortAnswer": {
      const sampleAnswer = typeof value.sampleAnswer === "string" ? value.sampleAnswer : "";
      if (!sampleAnswer) return null;
      const keyPoints = Array.isArray(value.keyPoints)
        ? value.keyPoints.filter((item): item is string => typeof item === "string" && Boolean(item))
        : undefined;
      return { id, type, prompt, explanation, sampleAnswer, keyPoints };
    }
    case "scenario": {
      const scenarioText = typeof value.scenarioText === "string" ? value.scenarioText : "";
      if (!scenarioText) return null;
      if (value.responseMode === "shortAnswer") {
        const sampleAnswer = typeof value.sampleAnswer === "string" ? value.sampleAnswer : "";
        if (!sampleAnswer) return null;
        const keyPoints = Array.isArray(value.keyPoints)
          ? value.keyPoints.filter((item): item is string => typeof item === "string" && Boolean(item))
          : undefined;
        return {
          id,
          type,
          prompt,
          explanation,
          scenarioText,
          responseMode: "shortAnswer",
          sampleAnswer,
          keyPoints,
        };
      }
      const choices = Array.isArray(value.choices)
        ? value.choices.filter((item): item is string => typeof item === "string" && Boolean(item))
        : [];
      const correctChoice = typeof value.correctChoice === "string" ? value.correctChoice : "";
      if (choices.length < 2 || !correctChoice) return null;
      return {
        id,
        type,
        prompt,
        explanation,
        scenarioText,
        responseMode: "multipleChoice",
        choices,
        correctChoice: choices.includes(correctChoice) ? correctChoice : choices[0],
      };
    }
    case "multipleChoice":
    default: {
      const choices = Array.isArray(value.choices)
        ? value.choices.filter((item): item is string => typeof item === "string" && Boolean(item))
        : [];
      const correctChoice = typeof value.correctChoice === "string" ? value.correctChoice : "";
      if (choices.length < 2 || !correctChoice) return null;
      return {
        id,
        type: "multipleChoice",
        prompt,
        explanation,
        choices,
        correctChoice: choices.includes(correctChoice) ? correctChoice : choices[0],
      };
    }
  }
}

/**
 * Hotspot questions are generated before a course (and its slug/asset URLs) exists.
 * Generation writes this placeholder in place of a real imageUrl; buildClassroomPlanFromLineup
 * resolves it to the real `/api/classroom/{slug}/slides/{index}` URL once the slug is known.
 */
export function hotspotSlidePlaceholder(slideIndex: number) {
  return `slide:${slideIndex}`;
}

export function resolveHotspotImageUrl(imageUrl: string, slug: string): string {
  const match = /^slide:(\d+)$/.exec(imageUrl);
  if (!match) return imageUrl;
  return `/api/classroom/${slug}/slides/${match[1]}`;
}

export function normalizeAssessmentQuestions(raw: unknown): ClassroomQuestion[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => normalizeAssessmentQuestion(item))
    .filter((item): item is ClassroomQuestion => Boolean(item));
}
