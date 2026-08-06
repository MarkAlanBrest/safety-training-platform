export type TeachingStyle =
  | "classroom"
  | "socratic"
  | "demonstration"
  | "coach"
  | "story"
  | "problem-solving"
  | "hands-on-lab";

export type InteractionLevel = "minimal" | "moderate" | "high" | "maximum";

export type AiPersonality =
  | "professional"
  | "friendly"
  | "encouraging"
  | "patient"
  | "energetic"
  | "direct"
  | "funny";

export type ReadBulletPoints = "never" | "when-important" | "always";

export type AssessmentFrequency = "rare" | "moderate" | "frequent" | "very-frequent";

export type ConversationMode =
  | "interrupt-anytime"
  | "raise-hand"
  | "checkpoints-only";

export type RetakeRule = "unlimited" | "once" | "twice" | "none";

/** "premium" = OpenAI TTS (costs money, consistent high-quality voice). "browser" =
 * the device's built-in speech synthesis (free, instant, but quality/voice varies by
 * student device/browser). */
export type VoiceProvider = "premium" | "browser";

export type ClassroomBuilderConfig = {
  knowledge: {
    courseName: string;
    description: string;
    estimatedMinutes: number;
    difficulty: "beginner" | "intermediate" | "advanced";
    passingScore: number;
    objectives: string[];
    additionalResources: string;
  };
  teaching: {
    style: TeachingStyle;
    interactionLevel: InteractionLevel;
    personality: AiPersonality;
    voice: string;
    voiceSpeed: number;
    voiceProvider: VoiceProvider;
    accent: string;
    readBulletPoints: ReadBulletPoints;
  };
  activities: Record<string, boolean>;
  presentation: Record<string, boolean>;
  studentExperience: Record<string, boolean>;
  formative: {
    frequency: AssessmentFrequency;
    allow: Record<string, boolean>;
  };
  summative: {
    types: Record<string, boolean>;
    randomizeQuestions: boolean;
    requireMastery: boolean;
    passingScore: number;
    retakeRule: RetakeRule;
  };
  adaptation: {
    ifStruggles: Record<string, boolean>;
    ifExcels: Record<string, boolean>;
  };
  settings: {
    conversationMode: ConversationMode;
    speechText: boolean;
    speechVoice: boolean;
    captions: boolean;
    bookmarks: boolean;
  };
};

export const TEACHING_STYLES: Array<{ id: TeachingStyle; label: string }> = [
  { id: "classroom", label: "Classroom Instructor" },
  { id: "socratic", label: "Socratic (Question Driven)" },
  { id: "demonstration", label: "Demonstration Based" },
  { id: "coach", label: "Coach" },
  { id: "story", label: "Story Based" },
  { id: "problem-solving", label: "Problem Solving" },
  { id: "hands-on-lab", label: "Hands-On Lab" },
];

export const INTERACTION_LEVELS: Array<{ id: InteractionLevel; label: string }> = [
  { id: "minimal", label: "Minimal" },
  { id: "moderate", label: "Moderate" },
  { id: "high", label: "High" },
  { id: "maximum", label: "Maximum" },
];

export const AI_PERSONALITIES: Array<{ id: AiPersonality; label: string }> = [
  { id: "professional", label: "Professional" },
  { id: "friendly", label: "Friendly" },
  { id: "encouraging", label: "Encouraging" },
  { id: "patient", label: "Patient" },
  { id: "energetic", label: "Energetic" },
  { id: "direct", label: "Direct" },
  { id: "funny", label: "Funny" },
];

export const VOICE_PROVIDER_OPTIONS: Array<{
  id: VoiceProvider;
  label: string;
  description: string;
}> = [
  {
    id: "premium",
    label: "Premium AI voice",
    description: "Natural, consistent, choose the specific voice below. Uses paid AI speech generation.",
  },
  {
    id: "browser",
    label: "Free browser voice (Mark)",
    description: "Uses the Mark voice when it is available on the student's device, with a free English system voice as a fallback.",
  },
];

export const VOICE_OPTIONS = [
  { id: "cedar", label: "Cedar" },
  { id: "marin", label: "Marin" },
  { id: "alloy", label: "Alloy" },
  { id: "echo", label: "Echo" },
  { id: "fable", label: "Fable" },
  { id: "onyx", label: "Onyx" },
  { id: "nova", label: "Nova" },
  { id: "shimmer", label: "Shimmer" },
];

export const ACCENT_OPTIONS = [
  { id: "neutral", label: "Neutral" },
  { id: "american", label: "American" },
  { id: "british", label: "British" },
  { id: "australian", label: "Australian" },
];

export const ACTIVITY_OPTIONS = [
  { id: "multipleChoice", label: "Multiple Choice" },
  { id: "multipleSelect", label: "Multiple Select" },
  { id: "trueFalse", label: "True / False" },
  { id: "matching", label: "Matching" },
  { id: "dragDrop", label: "Drag & Drop" },
  { id: "hotspots", label: "Hotspots" },
  { id: "flashCards", label: "Flash Cards" },
  { id: "fillBlank", label: "Fill In The Blank" },
  { id: "imageIdentification", label: "Image Identification" },
  { id: "labelDiagram", label: "Label The Diagram" },
  { id: "sequenceSteps", label: "Sequence Steps" },
  { id: "scenarioQuestions", label: "Scenario Questions" },
  { id: "calculations", label: "Calculations" },
  { id: "shortAnswer", label: "Short Answer" },
  { id: "reflection", label: "Reflection Questions" },
  { id: "discussions", label: "Discussions" },
  { id: "simulations", label: "Simulations (Future)" },
];

export const PRESENTATION_OPTIONS = [
  { id: "zoomPictures", label: "Zoom Pictures" },
  { id: "panImages", label: "Pan Across Images" },
  { id: "highlightObjects", label: "Highlight Objects" },
  { id: "circleObjects", label: "Circle Objects" },
  { id: "drawArrows", label: "Draw Arrows" },
  { id: "underlineText", label: "Underline Text" },
  { id: "fadeBackground", label: "Fade Background" },
  { id: "revealBullets", label: "Reveal Bullet Points" },
  { id: "compareImages", label: "Compare Images" },
  { id: "splitScreen", label: "Split Screen" },
  { id: "overlayLabels", label: "Overlay Labels" },
  { id: "animateDiagrams", label: "Animate Diagrams" },
  { id: "laserPointer", label: "Laser Pointer" },
  { id: "pictureInPicture", label: "Picture-in-Picture" },
];

export const STUDENT_EXPERIENCE_OPTIONS = [
  { id: "askPriorKnowledge", label: "Ask Prior Knowledge Questions" },
  { id: "encourageQuestions", label: "Encourage Student Questions" },
  { id: "checkUnderstanding", label: "Check Understanding Frequently" },
  { id: "explainMultipleWays", label: "Explain Multiple Ways" },
  { id: "realWorldExamples", label: "Give Real World Examples" },
  { id: "useAnalogies", label: "Use Analogies" },
  { id: "skipMastered", label: "Skip Mastered Content" },
  { id: "slowDown", label: "Slow Down If Needed" },
  { id: "reviewWeakAreas", label: "Review Weak Areas" },
  { id: "summarizeObjectives", label: "Summarize Each Objective" },
];

export const FORMATIVE_ALLOW_OPTIONS = [
  { id: "openQuestions", label: "Open Questions" },
  { id: "quickChecks", label: "Quick Checks" },
  { id: "polls", label: "Polls" },
  { id: "practicalIdentification", label: "Practical Identification" },
  { id: "explainOwnWords", label: "Explain In Your Own Words" },
  { id: "confidenceChecks", label: "Confidence Checks" },
];

export const SUMMATIVE_TYPE_OPTIONS = [
  { id: "multipleChoice", label: "Multiple Choice" },
  { id: "matching", label: "Matching" },
  { id: "dragDrop", label: "Drag & Drop" },
  { id: "hotspot", label: "Hotspot" },
  { id: "labelDiagram", label: "Label Diagram" },
  { id: "shortAnswer", label: "Short Answer" },
  { id: "practicalScenario", label: "Practical Scenario" },
];

export const STRUGGLE_OPTIONS = [
  { id: "explainAgain", label: "Explain Again" },
  { id: "anotherExample", label: "Use Another Example" },
  { id: "anotherPicture", label: "Show Another Picture" },
  { id: "zoomFurther", label: "Zoom Further" },
  { id: "giveHint", label: "Give Hint" },
  { id: "startPractice", label: "Start Practice Activity" },
  { id: "easierQuestion", label: "Ask Easier Question" },
  { id: "reviewPrevious", label: "Review Previous Objective" },
];

export const EXCEL_OPTIONS = [
  { id: "skipBasics", label: "Skip Basics" },
  { id: "increaseDifficulty", label: "Increase Difficulty" },
  { id: "deeperQuestions", label: "Ask Deeper Questions" },
  { id: "moveFaster", label: "Move Faster" },
];

export const CLASSROOM_BUILDER_LIMITS = {
  activities: 6,
  presentation: 5,
  studentExperience: 5,
  formativeAllow: 4,
  summativeTypes: 4,
  struggles: 4,
  excels: 3,
} as const;

export type ClassroomBuilderPreset = "focused" | "balanced" | "rich";

export const CLASSROOM_BUILDER_PRESETS: Array<{
  id: ClassroomBuilderPreset;
  label: string;
  description: string;
}> = [
  {
    id: "focused",
    label: "Focused",
    description: "Dialogue-first teaching with a few checks. Best for shorter lessons.",
  },
  {
    id: "balanced",
    label: "Balanced",
    description: "Recommended default. A mix of teaching, examples, and light practice.",
  },
  {
    id: "rich",
    label: "Rich",
    description: "More interaction and activity types, still capped so the class stays coherent.",
  },
];

function flagsFromOptions(
  options: Array<{ id: string }>,
  enabled: string[] = [],
) {
  return Object.fromEntries(options.map((item) => [item.id, enabled.includes(item.id)]));
}

export function countEnabled(flags: Record<string, boolean>) {
  return Object.values(flags).filter(Boolean).length;
}

export function canToggleFlag(
  flags: Record<string, boolean>,
  id: string,
  checked: boolean,
  max: number,
) {
  if (!checked) return true;
  if (flags[id]) return true;
  return countEnabled(flags) < max;
}

const PRESET_SELECTIONS: Record<
  ClassroomBuilderPreset,
  {
    teaching: Partial<ClassroomBuilderConfig["teaching"]>;
    activities: string[];
    presentation: string[];
    studentExperience: string[];
    formativeFrequency: AssessmentFrequency;
    formativeAllow: string[];
    summativeTypes: string[];
    struggles: string[];
    excels: string[];
  }
> = {
  focused: {
    teaching: { interactionLevel: "minimal" },
    activities: ["trueFalse", "scenarioQuestions", "reflection"],
    presentation: ["zoomPictures", "highlightObjects"],
    studentExperience: [
      "askPriorKnowledge",
      "encourageQuestions",
      "realWorldExamples",
    ],
    formativeFrequency: "rare",
    formativeAllow: ["openQuestions", "quickChecks"],
    summativeTypes: ["multipleChoice", "practicalScenario"],
    struggles: ["explainAgain", "giveHint"],
    excels: ["deeperQuestions"],
  },
  balanced: {
    teaching: { interactionLevel: "moderate" },
    activities: [
      "multipleChoice",
      "trueFalse",
      "scenarioQuestions",
      "shortAnswer",
      "reflection",
    ],
    presentation: [
      "zoomPictures",
      "highlightObjects",
      "drawArrows",
      "revealBullets",
    ],
    studentExperience: [
      "askPriorKnowledge",
      "encourageQuestions",
      "checkUnderstanding",
      "realWorldExamples",
      "summarizeObjectives",
    ],
    formativeFrequency: "moderate",
    formativeAllow: ["openQuestions", "quickChecks", "explainOwnWords"],
    summativeTypes: ["multipleChoice", "shortAnswer", "practicalScenario"],
    struggles: ["explainAgain", "anotherExample", "giveHint"],
    excels: ["deeperQuestions", "moveFaster"],
  },
  rich: {
    teaching: { interactionLevel: "high" },
    activities: [
      "multipleChoice",
      "multipleSelect",
      "trueFalse",
      "hotspots",
      "scenarioQuestions",
      "shortAnswer",
    ],
    presentation: [
      "zoomPictures",
      "highlightObjects",
      "drawArrows",
      "revealBullets",
      "laserPointer",
    ],
    studentExperience: [
      "askPriorKnowledge",
      "encourageQuestions",
      "checkUnderstanding",
      "realWorldExamples",
      "useAnalogies",
    ],
    formativeFrequency: "frequent",
    formativeAllow: [
      "openQuestions",
      "quickChecks",
      "explainOwnWords",
      "confidenceChecks",
    ],
    summativeTypes: [
      "multipleChoice",
      "matching",
      "hotspot",
      "practicalScenario",
    ],
    struggles: [
      "explainAgain",
      "anotherExample",
      "giveHint",
      "startPractice",
    ],
    excels: ["increaseDifficulty", "deeperQuestions", "moveFaster"],
  },
};

export function applyClassroomBuilderPreset(
  current: ClassroomBuilderConfig,
  preset: ClassroomBuilderPreset,
): ClassroomBuilderConfig {
  const selection = PRESET_SELECTIONS[preset];
  return {
    ...current,
    teaching: { ...current.teaching, ...selection.teaching },
    activities: flagsFromOptions(ACTIVITY_OPTIONS, selection.activities),
    presentation: flagsFromOptions(PRESENTATION_OPTIONS, selection.presentation),
    studentExperience: flagsFromOptions(
      STUDENT_EXPERIENCE_OPTIONS,
      selection.studentExperience,
    ),
    formative: {
      frequency: selection.formativeFrequency,
      allow: flagsFromOptions(FORMATIVE_ALLOW_OPTIONS, selection.formativeAllow),
    },
    summative: {
      ...current.summative,
      types: flagsFromOptions(SUMMATIVE_TYPE_OPTIONS, selection.summativeTypes),
    },
    adaptation: {
      ifStruggles: flagsFromOptions(STRUGGLE_OPTIONS, selection.struggles),
      ifExcels: flagsFromOptions(EXCEL_OPTIONS, selection.excels),
    },
  };
}

export function defaultClassroomBuilderConfig(
  overrides?: Partial<ClassroomBuilderConfig>,
): ClassroomBuilderConfig {
  const skeleton: ClassroomBuilderConfig = {
    knowledge: {
      courseName: "",
      description: "",
      estimatedMinutes: 45,
      difficulty: "intermediate",
      passingScore: 80,
      objectives: [""],
      additionalResources: "",
    },
    teaching: {
      style: "classroom",
      interactionLevel: "moderate",
      personality: "encouraging",
      voice: "cedar",
      voiceSpeed: 0.96,
      voiceProvider: "premium",
      accent: "neutral",
      readBulletPoints: "when-important",
    },
    activities: flagsFromOptions(ACTIVITY_OPTIONS),
    presentation: flagsFromOptions(PRESENTATION_OPTIONS),
    studentExperience: flagsFromOptions(STUDENT_EXPERIENCE_OPTIONS),
    formative: {
      frequency: "moderate",
      allow: flagsFromOptions(FORMATIVE_ALLOW_OPTIONS),
    },
    summative: {
      types: flagsFromOptions(SUMMATIVE_TYPE_OPTIONS),
      randomizeQuestions: true,
      requireMastery: true,
      passingScore: 80,
      retakeRule: "twice",
    },
    adaptation: {
      ifStruggles: flagsFromOptions(STRUGGLE_OPTIONS),
      ifExcels: flagsFromOptions(EXCEL_OPTIONS),
    },
    settings: {
      conversationMode: "interrupt-anytime",
      speechText: true,
      speechVoice: true,
      captions: true,
      bookmarks: true,
    },
  };

  const base = applyClassroomBuilderPreset(skeleton, "balanced");

  return {
    ...base,
    ...overrides,
    knowledge: { ...base.knowledge, ...overrides?.knowledge },
    teaching: { ...base.teaching, ...overrides?.teaching },
    activities: { ...base.activities, ...overrides?.activities },
    presentation: { ...base.presentation, ...overrides?.presentation },
    studentExperience: {
      ...base.studentExperience,
      ...overrides?.studentExperience,
    },
    formative: {
      ...base.formative,
      ...overrides?.formative,
      allow: { ...base.formative.allow, ...overrides?.formative?.allow },
    },
    summative: {
      ...base.summative,
      ...overrides?.summative,
      types: { ...base.summative.types, ...overrides?.summative?.types },
    },
    adaptation: {
      ...base.adaptation,
      ...overrides?.adaptation,
      ifStruggles: {
        ...base.adaptation.ifStruggles,
        ...overrides?.adaptation?.ifStruggles,
      },
      ifExcels: {
        ...base.adaptation.ifExcels,
        ...overrides?.adaptation?.ifExcels,
      },
    },
    settings: { ...base.settings, ...overrides?.settings },
  };
}

export type ClassroomEstimates = {
  courseLengthMinutes: number;
  aiCostPerStudentUsd: number;
  activityCount: number;
  formativeCount: number;
  finalAssessmentQuestions: number;
};

export function estimateClassroomCourse(
  slideCount: number,
  config: ClassroomBuilderConfig,
): ClassroomEstimates {
  const interactionMultiplier =
    config.teaching.interactionLevel === "minimal"
      ? 0.7
      : config.teaching.interactionLevel === "moderate"
        ? 1
        : config.teaching.interactionLevel === "high"
          ? 1.35
          : 1.6;

  const enabledActivities = Object.values(config.activities).filter(Boolean).length;
  const formativeMultiplier =
    config.formative.frequency === "rare"
      ? 0.5
      : config.formative.frequency === "moderate"
        ? 1
        : config.formative.frequency === "frequent"
          ? 1.5
          : 2;

  const courseLengthMinutes = Math.round(
    (config.knowledge.estimatedMinutes || slideCount * 4) * interactionMultiplier,
  );
  const activityCount = Math.max(
    3,
    Math.round(enabledActivities * 0.45 + slideCount * 0.35),
  );
  const formativeCount = Math.max(
    2,
    Math.round((slideCount / 3) * formativeMultiplier),
  );
  const finalAssessmentQuestions = Math.max(
    5,
    Math.round(
      Object.values(config.summative.types).filter(Boolean).length * 1.5 +
        config.knowledge.objectives.filter(Boolean).length,
    ),
  );

  const aiCostPerStudentUsd = Number(
    (
      courseLengthMinutes * 0.012 +
      activityCount * 0.04 +
      formativeCount * 0.03 +
      finalAssessmentQuestions * 0.02
    ).toFixed(2),
  );

  return {
    courseLengthMinutes,
    aiCostPerStudentUsd,
    activityCount,
    formativeCount,
    finalAssessmentQuestions,
  };
}

function enabledLabels(flags: Record<string, boolean>, options: Array<{ id: string; label: string }>) {
  return options.filter((item) => flags[item.id]).map((item) => item.label);
}

export function classroomInstructorPrompt(config: ClassroomBuilderConfig) {
  const style = TEACHING_STYLES.find((item) => item.id === config.teaching.style)?.label;
  const personality = AI_PERSONALITIES.find(
    (item) => item.id === config.teaching.personality,
  )?.label;

  return [
    `Teaching style: ${style}. Personality: ${personality}. Interaction level: ${config.teaching.interactionLevel}.`,
    `Allowed activities: ${enabledLabels(config.activities, ACTIVITY_OPTIONS).join(", ") || "discussion only"}.`,
    `Presentation tools available: ${enabledLabels(config.presentation, PRESENTATION_OPTIONS).join(", ") || "slides only"}.`,
    `Student experience priorities: ${enabledLabels(config.studentExperience, STUDENT_EXPERIENCE_OPTIONS).join(", ")}.`,
    `Formative assessment frequency: ${config.formative.frequency}. Allowed checks: ${enabledLabels(config.formative.allow, FORMATIVE_ALLOW_OPTIONS).join(", ")}.`,
    `Summative assessment types: ${enabledLabels(config.summative.types, SUMMATIVE_TYPE_OPTIONS).join(", ") || "none"}. Passing score: ${config.summative.passingScore}%. Retakes: ${config.summative.retakeRule}.`,
    `If the student struggles: ${enabledLabels(config.adaptation.ifStruggles, STRUGGLE_OPTIONS).join(", ")}.`,
    `If the student excels: ${enabledLabels(config.adaptation.ifExcels, EXCEL_OPTIONS).join(", ")}.`,
    `Conversation mode: ${config.settings.conversationMode}.`,
    config.teaching.readBulletPoints === "always"
      ? "Read bullet points aloud when they appear on screen."
      : config.teaching.readBulletPoints === "when-important"
        ? "Read bullet points only when they are important teaching points."
        : "Do not read bullet points verbatim; paraphrase instead.",
  ].join("\n");
}
