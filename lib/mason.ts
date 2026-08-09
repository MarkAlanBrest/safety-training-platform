export type LessonMoment = {
  kind:
    | "explain"
    | "text"
    | "tiles"
    | "dragdrop"
    | "visual"
    | "flashcard"
    | "hotspot"
    | "tutor"
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
  flashcards?: Array<{ front: string; back: string }> | null;
  hotspotPoints?: Array<{
    x: number;
    y: number;
    label: string;
    text: string;
  }> | null;
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

export type PlayerSettings = {
  appearance: "light" | "dark";
  toolbarStyle: "minimal" | "guided";
  aiCoach: "off" | "ask" | "guided";
  knowledgeScope: "course" | "expanded";
};

export const defaultPlayerSettings: PlayerSettings = {
  appearance: "light",
  toolbarStyle: "guided",
  aiCoach: "ask",
  knowledgeScope: "course",
};

export function normalizePlayerSettings(value: unknown): PlayerSettings {
  const settings = value && typeof value === "object" && !Array.isArray(value)
    ? (value as Partial<PlayerSettings>)
    : {};
  return {
    appearance: settings.appearance === "dark" ? "dark" : "light",
    toolbarStyle: settings.toolbarStyle === "minimal" ? "minimal" : "guided",
    aiCoach: ["off", "ask", "guided"].includes(String(settings.aiCoach))
      ? (settings.aiCoach as PlayerSettings["aiCoach"])
      : "ask",
    knowledgeScope: settings.knowledgeScope === "expanded" ? "expanded" : "course",
  };
}

export type LessonPlan = {
  sectionTitle: string;
  opening: string;
  objectives: string[];
  summary: string;
  keyFacts: string[];
  moments: LessonMoment[];
  playerSettings?: PlayerSettings;
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
  description:
    "A preview of every teaching moment type: explain, text, tiles, visual, drag-to-order, scenario, question, and summary.",
  published: true,
  sections: [
    {
      id: 0,
      title: "Safe Ladder Setup",
      position: 1,
      fileName: "demo.pdf",
      estimatedMinutes: 12,
      lessonPlan: {
        sectionTitle: "Safe Ladder Setup",
        opening:
          "Let’s learn how a thirty-second setup check can prevent a life-changing fall.",
        objectives: [
          "Recognize a stable setup surface",
          "Apply the 4-to-1 rule",
          "Sequence setup steps in the safest order",
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
            phase: "learn",
            title: "Before your feet leave the ground",
            narration:
              "Most ladder incidents begin before anyone climbs. Start by checking the ladder, the surface, and the space around the work.\n\nA quick pre-use inspection takes less than a minute. Look at side rails, rungs, feet, locks, and labels. If anything is bent, cracked, or missing, tag the ladder and remove it from service before someone else reaches for it.",
            prompt: null,
            choices: null,
            correctAnswer: null,
            feedback: null,
            pageNumber: null,
          },
          {
            kind: "text",
            phase: "learn",
            title: "Build the setup from the ground up",
            narration:
              "Clear the area and examine the support surface before raising the ladder. The feet need stable, level support.\n\nDo not place a ladder on boxes, barrels, loose material, or makeshift blocks to gain height. Slippery surfaces require effective securing or slip-resistant feet, and those feet do not replace careful placement.\n\nAt the top, both rails of a non-self-supporting ladder should be supported equally. Keep the top and bottom areas clear before anyone climbs.",
            prompt: null,
            choices: null,
            correctAnswer: null,
            feedback: null,
            pageNumber: null,
          },
          {
            kind: "tiles",
            phase: "learn",
            title: "Three setup checks",
            narration:
              "Use the same three-part check every time you set a ladder.",
            prompt: null,
            choices: null,
            correctAnswer: null,
            feedback: null,
            pageNumber: null,
            tiles: [
              {
                title: "Surface",
                body: "Firm, level ground with no loose debris, oil, or unstable fill under the feet.",
              },
              {
                title: "Angle",
                body: "About one foot out for every four feet of working length along the ladder.",
              },
              {
                title: "Security",
                body: "Top and bottom secured or barricaded when traffic, doors, or wind could move the ladder.",
              },
            ],
          },
          {
            kind: "visual",
            phase: "learn",
            title: "The 4-to-1 rule",
            narration:
              "Picture an extension ladder reaching sixteen feet high. Its base should be four feet away from the wall. This creates a stable climbing angle.",
            cue: "Watch how working length, base distance, and angle work together.",
            visualAction: "zoom",
            focusX: 46,
            focusY: 72,
            focusScale: 1.45,
            visualType: "formula",
            visualItems: ["Working length ÷ 4", "Base distance", "Stable angle"],
            explainerStyle: "flipbook",
            explainerFrames: [
              {
                title: "Inspect",
                caption: "Check the ladder and landing area first.",
                narration:
                  "Before you measure the angle, confirm the ladder is sound and the support surface is stable.",
                visualItems: ["Rails", "Rungs", "Feet"],
                focusX: 30,
                focusY: 40,
                focusScale: 1.35,
                sourceImage: "/course-assets/ladder-safety/ladder-inspection.png",
              },
              {
                title: "Measure",
                caption: "Estimate working length from foot to top support.",
                narration:
                  "Working length runs along the ladder from its foot to the top support—not simply the height of the wall.",
                visualItems: ["Foot", "Top support", "Working length"],
                focusX: 50,
                focusY: 55,
                focusScale: 1.4,
                sourceImage: "/course-assets/ladder-safety/four-to-one-setup.png",
              },
              {
                title: "Place",
                caption: "Set the base at working length divided by four.",
                narration:
                  "A sixteen-foot working length calls for a base about four feet out. Too close increases tipping risk; too far increases sliding.",
                visualItems: ["16 ÷ 4 = 4", "Base distance"],
                focusX: 70,
                focusY: 72,
                focusScale: 1.45,
                sourceImage: "/course-assets/ladder-safety/four-to-one-setup.png",
              },
            ],
            prompt: null,
            choices: null,
            correctAnswer: null,
            feedback: null,
            pageNumber: null,
          },
          {
            kind: "dragdrop",
            phase: "activity",
            title: "Put the setup in order",
            narration:
              "Arrange these setup actions from first step to final check.",
            prompt: "Drag these actions into the safest order.",
            choices: null,
            correctAnswer: null,
            feedback: null,
            pageNumber: null,
            dragItems: [
              "Clear the area and inspect the ladder",
              "Place the feet on firm, level support",
              "Set the base using the four-to-one ratio",
              "Secure the top and bottom against displacement",
              "Verify the setup before climbing",
            ],
          },
          {
            kind: "scenario",
            phase: "activity",
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
            phase: "activity",
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
            kind: "question",
            phase: "mastery",
            title: "Mastery: setup readiness",
            narration:
              "A worker sets a ladder on firm ground, applies the four-to-one ratio, and secures the top—but leaves the base in front of an active doorway.",
            prompt: "What is still missing?",
            choices: [
              "Nothing; the angle is correct",
              "A barricade or securing control to keep traffic away from the ladder",
              "A second ladder at the top",
              "Permission from the building owner",
            ],
            correctAnswer: 1,
            feedback:
              "Correct. Ladders exposed to doorways or workplace traffic must be secured against displacement or protected by a barricade.",
            pageNumber: null,
          },
          {
            kind: "summary",
            phase: "learn",
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
  if (!Array.isArray(plan.moments)) {
    return plan;
  }

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
