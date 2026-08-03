export type LessonMoment = {
  kind:
    | "explain"
    | "text"
    | "tiles"
    | "dragdrop"
    | "visual"
    | "question"
    | "scenario"
    | "summary";
  phase?: "learn" | "activity" | "mastery";
  title: string;
  narration: string;
  prompt: string | null;
  choices: string[] | null;
  correctAnswer: number | null;
  feedback: string | null;
  pageNumber: number | null;
  sourceImage?: string | null;
  sourceImageAlt?: string | null;
  cue?: string | null;
  visualAction?: "none" | "zoom" | "spotlight" | "compare" | null;
  focusX?: number | null;
  focusY?: number | null;
  focusScale?: number | null;
  visualType?: "process" | "anatomy" | "comparison" | "formula" | "sequence" | null;
  visualItems?: string[] | null;
  tiles?: Array<{ title: string; body: string }> | null;
  dragItems?: string[] | null;
  explainerStyle?: "flipbook" | "guided-focus" | "compare-reveal" | "step-build" | null;
  explainerFrames?: Array<{
    title: string;
    caption: string;
    narration: string;
    visualItems: string[];
    focusX?: number | null;
    focusY?: number | null;
    focusScale?: number | null;
    sourceImage?: string | null;
  }> | null;
  /** Learner-only: pictures + narrations with step labels, overlay metadata removed. */
  playerFrames?: Array<{
    image: string;
    narration: string;
    label?: string;
  }> | null;
};

export type LessonPlan = {
  sectionTitle: string;
  opening: string;
  objectives: string[];
  summary: string;
  keyFacts: string[];
  moments: LessonMoment[];
};

export type PublicMasonSection = {
  id: number;
  title: string;
  position: number;
  fileName: string;
  estimatedMinutes?: number;
  lessonPlan: LessonPlan;
};

export type PublicMasonCourse = {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  audience?: string | null;
  theme?: string;
  companyName?: string | null;
  logoData?: string | null;
  accentColor?: string | null;
  displayMode?: "webpage" | "slideshow";
  intensity?: string;
  estimatedMinutes?: number;
  published: boolean;
  sections: PublicMasonSection[];
};

export const demoCourse: PublicMasonCourse = {
  id: 0,
  title: "Interactive Ladder Safety",
  slug: "demo",
  description: "A short preview of an AI-guided teaching experience.",
  published: true,
  sections: [
    {
      id: 0,
      title: "Safe Ladder Setup",
      position: 1,
      fileName: "demo.pdf",
      lessonPlan: {
        sectionTitle: "Safe Ladder Setup",
        opening:
          "Let’s learn how a thirty-second setup check can prevent a life-changing fall.",
        objectives: [
          "Recognize a stable setup surface",
          "Apply the 4-to-1 rule",
          "Know when a ladder should not be used",
        ],
        summary:
          "A safe ladder starts on firm, level ground, uses the correct angle, and is secured before climbing.",
        keyFacts: [
          "Inspect the ladder before each use.",
          "For every four feet of height, place the base one foot out.",
          "Never compensate for uneven ground with loose objects.",
        ],
        moments: [
          {
            kind: "explain",
            title: "Before your feet leave the ground",
            narration:
              "Most ladder incidents begin before anyone climbs. Start by checking the ladder, the surface, and the space around the work.",
            prompt: null,
            choices: null,
            correctAnswer: null,
            feedback: null,
            pageNumber: null,
          },
          {
            kind: "visual",
            title: "The 4-to-1 rule",
            narration:
              "Picture an extension ladder reaching sixteen feet high. Its base should be four feet away from the wall. This creates a stable climbing angle.",
            cue: "I want to show you why the angle matters. Watch what happens at the base of the ladder.",
            visualAction: "zoom",
            focusX: 46,
            focusY: 72,
            focusScale: 1.45,
            prompt: "What changes if the ladder reaches twenty feet?",
            choices: null,
            correctAnswer: null,
            feedback: null,
            pageNumber: null,
          },
          {
            kind: "scenario",
            title: "You arrive at the job",
            narration:
              "The only available ground is uneven gravel. A coworker suggests placing scrap wood under one foot of the ladder.",
            prompt: "What is the safest decision?",
            choices: [
              "Use the scrap wood",
              "Have someone hold the ladder",
              "Move the work or create a proper level surface",
            ],
            correctAnswer: 2,
            feedback:
              "Correct—the ladder needs firm, level support. A helper cannot make an unstable setup safe.",
            pageNumber: null,
          },
          {
            kind: "question",
            title: "Quick check",
            narration: "Let’s make sure the setup ratio is clear.",
            prompt:
              "A ladder reaches twelve feet up a wall. About how far out should its base be?",
            choices: ["1 foot", "3 feet", "6 feet"],
            correctAnswer: 1,
            feedback:
              "Exactly. Twelve divided by four is three, so the base belongs about three feet out.",
            pageNumber: null,
          },
          {
            kind: "summary",
            title: "Your setup habit",
            narration:
              "Inspect first, choose firm and level ground, set the correct angle, and secure the ladder. If any part feels improvised, stop and correct it.",
            prompt: null,
            choices: null,
            correctAnswer: null,
            feedback: null,
            pageNumber: null,
          },
        ],
      },
    },
  ],
};

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

/** Strip on-screen visual explainer metadata before sending lesson data to learners. */
export function buildPlayerFrames(
  moment: LessonMoment,
): Array<{ image: string; narration: string; label?: string }> {
  const curatedImages = CURATED_EXPLAINER_IMAGES[moment.title];
  if (moment.playerFrames?.length && !curatedImages) {
    return moment.playerFrames.filter(
      (frame) => frame.image.trim() && frame.narration.trim(),
    );
  }

  if (moment.explainerFrames?.length) {
    return moment.explainerFrames
      .map((frame) => ({
        image: curatedImages?.[frame.title] ?? frame.sourceImage ?? "",
        narration: frame.narration,
        label: frame.title,
      }))
      .filter((frame) => frame.image.trim() && frame.narration.trim());
  }

  if (moment.sourceImage || moment.narration) {
    return [
      {
        image: moment.sourceImage ?? "",
        narration: moment.narration,
        label: moment.title || undefined,
      },
    ];
  }

  return [];
}

const CURATED_EXPLAINER_IMAGES: Record<string, Record<string, string>> = {
  "From respectful conduct to prohibited conduct": {
    Respect: "/course-assets/workplace-harassment/visual-explainer/respect.png",
    Recognize: "/course-assets/workplace-harassment/visual-explainer/recognize.png",
    Respond: "/course-assets/workplace-harassment/visual-explainer/respond.png",
    Prevent: "/course-assets/workplace-harassment/visual-explainer/prevent.png",
  },
  "Conduct, context, and impact": {
    Conduct: "/course-assets/workplace-harassment/visual-explainer/conduct.png",
    Context: "/course-assets/workplace-harassment/visual-explainer/context.png",
    Impact: "/course-assets/workplace-harassment/visual-explainer/impact.png",
    Pattern: "/course-assets/workplace-harassment/visual-explainer/pattern.png",
  },
  "What happens after a concern is raised": {
    Receive: "/course-assets/workplace-harassment/visual-explainer/receive.png",
    Protect: "/course-assets/workplace-harassment/visual-explainer/protect.png",
    Review: "/course-assets/workplace-harassment/visual-explainer/review.png",
    Act: "/course-assets/workplace-harassment/visual-explainer/act.png",
    "Follow up": "/course-assets/workplace-harassment/visual-explainer/follow-up.png",
  },
  "Five practical bystander choices": {
    Direct: "/course-assets/workplace-harassment/visual-explainer/recognize.png",
    Distract: "/course-assets/workplace-harassment/visual-explainer/respect.png",
    Delegate: "/course-assets/workplace-harassment/visual-explainer/respond.png",
    Delay: "/course-assets/workplace-harassment/visual-explainer/impact.png",
    Document: "/course-assets/workplace-harassment/visual-explainer/review.png",
  },
  "What consent requires": {
    "Freely given": "/course-assets/workplace-harassment/visual-explainer/respect.png",
    Specific: "/course-assets/workplace-harassment/visual-explainer/conduct.png",
    Reversible: "/course-assets/workplace-harassment/visual-explainer/context.png",
    Capable: "/course-assets/workplace-harassment/visual-explainer/recognize.png",
  },
  "A survivor-centered first response": {
    Listen: "/course-assets/workplace-harassment/visual-explainer/receive.png",
    Safety: "/course-assets/workplace-harassment/visual-explainer/protect.png",
    Options: "/course-assets/workplace-harassment/visual-explainer/respond.png",
    Privacy: "/course-assets/workplace-harassment/visual-explainer/respect.png",
    "Follow up": "/course-assets/workplace-harassment/visual-explainer/follow-up.png",
  },
};

export function sanitizeVisualMomentForLearner(moment: LessonMoment): LessonMoment {
  if (moment.kind !== "visual") return moment;

  const playerFrames = buildPlayerFrames(moment).map((frame) => ({
    image: frame.image,
    narration: frame.narration,
    label: frame.label,
  }));

  return {
    kind: "visual",
    phase: moment.phase,
    title: "",
    narration: "",
    prompt: null,
    choices: null,
    correctAnswer: null,
    feedback: null,
    pageNumber: null,
    sourceImage: null,
    sourceImageAlt: null,
    cue: null,
    visualAction: null,
    focusX: null,
    focusY: null,
    focusScale: null,
    visualType: null,
    visualItems: [],
    explainerStyle: "flipbook",
    explainerFrames: null,
    playerFrames,
  };
}

export function sanitizeLessonPlanForLearner(plan: LessonPlan): LessonPlan {
  return {
    ...plan,
    moments: plan.moments.map((moment) => sanitizeVisualMomentForLearner(moment)),
  };
}

export function sanitizeCourseForLearner(course: PublicMasonCourse): PublicMasonCourse {
  return {
    ...course,
    sections: course.sections.map((section) => ({
      ...section,
      lessonPlan: sanitizeLessonPlanForLearner(section.lessonPlan),
    })),
  };
}
