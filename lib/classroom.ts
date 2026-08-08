import type { ClassroomBuilderConfig } from "@/lib/classroom-builder";
import type { ClassroomSlideHotspot, ClassroomSlideFocus } from "@/lib/classroom-focus";
import type { LessonLineupItem } from "@/lib/classroom-lineup";
import type {
  ClassroomAssessmentQuestion,
  ClassroomCheckpoint,
  ClassroomLessonBeat,
} from "@/lib/classroom-lesson";
import {
  buildFallbackAssessment,
  buildFallbackCheckpoints,
  buildLessonBeats,
} from "@/lib/classroom-lesson";
import type { ClassroomFinalTest } from "@/lib/classroom-question-types";

export type { LessonLineupItem, LineupContentSlide, LineupFormative, LineupActivity, SlideTransition } from "@/lib/classroom-lineup";

export type ClassroomSlideVisual = {
  label: string;
  imageUrl: string;
};

export type ClassroomSlide = {
  index: number;
  title: string;
  bodyText: string;
  speakerNotes: string;
  subtitle?: string;
  bullets?: string[];
  highlight?: string;
  layout?: "title" | "content" | "image" | "split" | "blueprint";
  /** Visual transition when this slide enters the stage. */
  transition?: import("@/lib/classroom-lineup").SlideTransition;
  hotspots?: ClassroomSlideHotspot[];
  imageDataUrl?: string;
  imageUrl?: string;
  visuals?: ClassroomSlideVisual[];
  chapterId?: string;
  chapterTitle?: string;
};

export type { ClassroomSlideHotspot, ClassroomSlideFocus };

export type ClassroomChapter = {
  id: string;
  sectionId?: number;
  title: string;
  slideStart: number;
  slideEnd: number;
  /** API URL to the original .pptx for live slide rendering */
  deckUrl?: string;
  /** Optional assessment shown immediately after this chapter's final slide. */
  finalTest?: ClassroomFinalTest;
};

export type ClassroomTopic = {
  id: string;
  title: string;
  slideStart: number;
  slideEnd: number;
};

export type ClassroomPlan = {
  type: "classroom";
  title: string;
  opening: string;
  objectives: string[];
  topics: ClassroomTopic[];
  chapters?: ClassroomChapter[];
  slides: ClassroomSlide[];
  /** Author-defined lesson order: content slides, formative checks, and activities. */
  lineup?: LessonLineupItem[];
  checkpoints?: ClassroomCheckpoint[];
  assessment?: ClassroomAssessmentQuestion[];
  /** New configurable Final Test container. Additive — old plans have no finalTest and keep using `assessment`. */
  finalTest?: ClassroomFinalTest;
  lessonBeats?: ClassroomLessonBeat[];
  config?: ClassroomBuilderConfig;
};

export type { ClassroomCheckpoint, ClassroomAssessmentQuestion, ClassroomLessonBeat };

/** A comprehension check the AI is asking this turn, rendered in its own dedicated card. */
export type ClassroomCheckQuestion = {
  prompt: string;
  type: "multipleChoice" | "trueFalse" | "shortAnswer";
  options?: string[];
};

export type PresentationView =
  | {
      type: "slide";
      slideIndex: number;
      headline?: string;
      imageIndex?: number;
      focus?: ClassroomSlideFocus;
    }
  | {
      type: "question";
      headline: string;
      prompt: string;
      choices?: string[];
    }
  | {
      type: "exercise";
      headline: string;
      prompt: string;
      choices?: string[];
    }
  | {
      type: "example";
      headline: string;
      body: string;
      imageDataUrl?: string;
    }
  | {
      type: "assessment";
      headline: string;
      prompt: string;
      choices?: string[];
      questionIndex?: number;
      questionCount?: number;
    }
  | {
      type: "flashcard";
      headline: string;
      prompt?: string;
      flashcards: Array<{ front: string; back: string }>;
    }
  | {
      type: "dragdrop";
      headline: string;
      prompt: string;
      dragItems: string[];
    }
  | {
      type: "hotspot";
      headline: string;
      prompt: string;
      imageUrl: string;
      targetX: number;
      targetY: number;
      toleranceRadius: number;
    }
  | {
      type: "video";
      headline: string;
      prompt: string;
      videoUrl: string;
    }
  | {
      type: "welcome";
      headline: string;
      body: string;
    };

export type PublicClassroomCourse = {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  companyName?: string | null;
  logoData?: string | null;
  accentColor?: string | null;
  published: boolean;
  plan: ClassroomPlan;
};

export const DEFAULT_QUICK_REPLIES = [
  "That makes sense",
  "Could you rephrase that?",
  "Raise your hand",
  "I'm not sure yet",
  "Can you show an example?",
];

const demoSlideImages = [
  "/classroom/demo/slide-1.jpg",
  "/classroom/demo/slide-2.jpg",
  "/classroom/demo/slide-3.jpg",
  "/classroom/demo/slide-4.jpg",
];

const demoSlides: ClassroomSlide[] = [
  {
    index: 0,
    title: "Why ladder safety matters",
    bodyText:
      "Falls from ladders are one of the most common serious injuries on job sites. Most incidents happen during routine tasks, not dramatic failures.",
    speakerNotes:
      "Open with a question: ask what the learner has seen on a job site before explaining statistics.",
    imageUrl: demoSlideImages[0],
    layout: "blueprint",
    hotspots: [
      {
        id: "ladder",
        label: "Extension ladder",
        description: "The main access point where fall risk is highest.",
        x: 52,
        y: 46,
      },
      {
        id: "worker",
        label: "Worker position",
        description: "Body orientation and reach matter for balance.",
        x: 63,
        y: 58,
      },
    ],
  },
  {
    index: 1,
    title: "The 4-to-1 rule",
    bodyText:
      "For every four feet of working height, the ladder base should sit one foot away from the wall. This angle keeps the ladder stable.",
    speakerNotes:
      "Walk through a quick example with a 16-foot working height. Ask the learner to predict the base distance before revealing the answer.",
    imageUrl: demoSlideImages[1],
    layout: "blueprint",
    hotspots: [
      {
        id: "base-distance",
        label: "Base distance",
        description: "This horizontal distance should be one quarter of the working height.",
        x: 42,
        y: 72,
      },
      {
        id: "working-height",
        label: "Working height",
        description: "Measure from the ground support point to the top support point.",
        x: 68,
        y: 34,
      },
    ],
  },
  {
    index: 2,
    title: "Three-point contact",
    bodyText:
      "Keep three points of contact while climbing: two hands and one foot, or two feet and one hand. Carry tools on a belt or hoist them up.",
    speakerNotes:
      "Use a scenario: learner is carrying a drill while climbing. Ask whether that setup is acceptable.",
    imageUrl: demoSlideImages[2],
    layout: "blueprint",
    hotspots: [
      {
        id: "hands",
        label: "Hand placement",
        description: "Two secure handholds maintain control while climbing.",
        x: 48,
        y: 40,
      },
      {
        id: "foot",
        label: "Foot placement",
        description: "One foot stays planted while the other moves.",
        x: 55,
        y: 68,
      },
    ],
  },
  {
    index: 3,
    title: "When to stop and reassess",
    bodyText:
      "Stop work when the surface is unstable, weather changes, the ladder is damaged, or you feel rushed. A reset is faster than an injury.",
    speakerNotes:
      "Close by asking the learner to name one situation where they would pause and reassess.",
    imageUrl: demoSlideImages[3],
    layout: "blueprint",
    hotspots: [
      {
        id: "hard-hat",
        label: "PPE check",
        description: "Pause if protection or equipment is missing or damaged.",
        x: 50,
        y: 42,
      },
      {
        id: "hazard-scan",
        label: "Hazard scan",
        description: "Look for changing conditions before continuing work.",
        x: 72,
        y: 55,
      },
    ],
  },
];

const demoCheckpoints = buildFallbackCheckpoints(demoSlides);
const demoAssessment = buildFallbackAssessment(demoSlides);
const demoLessonBeats = buildLessonBeats({
  type: "classroom",
  title: "Ladder Safety Fundamentals",
  opening:
    "Welcome. I will teach this like a real class — I will show slides, ask what you already know, and adjust based on your answers.",
  objectives: [
    "Explain why ladder setup decisions matter",
    "Apply the 4-to-1 rule",
    "Describe three-point contact",
    "Know when to stop and reassess",
  ],
  topics: [
    { id: "intro", title: "Why it matters", slideStart: 0, slideEnd: 0 },
    { id: "angle", title: "Ladder angle", slideStart: 1, slideEnd: 1 },
    { id: "climb", title: "Climbing safely", slideStart: 2, slideEnd: 2 },
    { id: "stop", title: "When to pause", slideStart: 3, slideEnd: 3 },
  ],
  slides: demoSlides,
  checkpoints: demoCheckpoints,
  assessment: demoAssessment,
});

export const demoClassroomCourse: PublicClassroomCourse = {
  id: 0,
  title: "AI Classroom: Ladder Safety",
  slug: "demo",
  description:
    "A live AI instructor uses slide knowledge, asks questions, and adapts the lesson as you respond.",
  published: true,
  plan: {
    type: "classroom",
    title: "Ladder Safety Fundamentals",
    opening:
      "Welcome. I will teach this like a real class — I will show slides, ask what you already know, and adjust based on your answers.",
    objectives: [
      "Explain why ladder setup decisions matter",
      "Apply the 4-to-1 rule",
      "Describe three-point contact",
      "Know when to stop and reassess",
    ],
    topics: [
      { id: "intro", title: "Why it matters", slideStart: 0, slideEnd: 0 },
      { id: "angle", title: "Ladder angle", slideStart: 1, slideEnd: 1 },
      { id: "climb", title: "Climbing safely", slideStart: 2, slideEnd: 2 },
      { id: "stop", title: "When to pause", slideStart: 3, slideEnd: 3 },
    ],
    slides: demoSlides,
    checkpoints: demoCheckpoints,
    assessment: demoAssessment,
    lessonBeats: demoLessonBeats,
  },
};

export function slideImageSrc(
  slide: ClassroomSlide,
  imageIndex?: number,
  topic?: string,
) {
  if (typeof imageIndex === "number" && slide.visuals?.[imageIndex]?.imageUrl) {
    return slide.visuals[imageIndex].imageUrl;
  }
  if (slide.visuals?.length && topic) {
    const matched = matchVisualForTopic(slide, topic);
    if (matched) return matched.imageUrl;
  }
  if (slide.visuals?.length) {
    const matched = matchVisualForTopic(slide, slide.title);
    if (matched) return matched.imageUrl;
  }
  return slide.imageUrl || slide.imageDataUrl || "";
}

export function matchVisualForTopic(
  slide: ClassroomSlide,
  topic: string,
): ClassroomSlideVisual | undefined {
  if (!slide.visuals?.length) return undefined;
  const normalized = topic.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
  if (!normalized) return slide.visuals[0];

  let best: ClassroomSlideVisual | undefined;
  let bestScore = 0;
  for (const visual of slide.visuals) {
    const label = visual.label.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
    if (!label) continue;
    if (normalized.includes(label) || label.includes(normalized)) {
      return visual;
    }
    const topicWords = normalized.split(/\s+/).filter((word) => word.length > 2);
    const labelWords = label.split(/\s+/).filter((word) => word.length > 2);
    const overlap = topicWords.filter((word) =>
      labelWords.some((labelWord) => labelWord.includes(word) || word.includes(labelWord)),
    ).length;
    const score = overlap / Math.max(topicWords.length, labelWords.length, 1);
    if (score > bestScore) {
      bestScore = score;
      best = visual;
    }
  }
  return bestScore >= 0.34 ? best : slide.visuals[0];
}

export function classroomSlideAssetPath(
  index: number,
  imageIndex = 0,
  chapterPosition = 1,
) {
  const base =
    chapterPosition <= 1
      ? `classroom/slides/${index}`
      : `classroom/chapters/${chapterPosition}/slides/${index}`;
  return imageIndex > 0 ? `${base}/img-${imageIndex}` : base;
}

function slideAssetUrl(
  slug: string,
  slideIndex: number,
  imageIndex = 0,
  chapterPosition = 1,
) {
  if (chapterPosition <= 1) {
    return imageIndex > 0
      ? `/api/classroom/${slug}/slides/${slideIndex}/${imageIndex}`
      : `/api/classroom/${slug}/slides/${slideIndex}`;
  }
  return `/api/classroom/${slug}/chapters/${chapterPosition}/slides/${slideIndex}`;
}

function parseClassroomDeckPath(assetPath: string) {
  const chapter = assetPath.match(/^classroom\/chapters\/(\d+)\/deck\.pptx$/i);
  if (chapter) return { chapterPosition: Number(chapter[1]) };
  if (/^classroom\/deck\.pptx$/i.test(assetPath)) return { chapterPosition: 1 };
  return null;
}

export function classroomDeckUrl(slug: string, chapterPosition = 1) {
  return chapterPosition <= 1
    ? `/api/classroom/${slug}/deck`
    : `/api/classroom/${slug}/chapters/${chapterPosition}/deck`;
}

export function classroomEmbedDeckUrl(deckUrl: string) {
  // Office's remote fetcher is more reliable when the actual path ends in the
  // document extension (a query-string filename hint is not always honored).
  return deckUrl.replace(/\/deck$/, "/presentation.pptx");
}

/** Stable public origin Office Online uses to fetch published decks. */
export function classroomPublicOrigin() {
  return (
    process.env.NEXT_PUBLIC_APP_ORIGIN ||
    "https://safety-training-platform-eight.vercel.app"
  );
}

/** Absolute HTTPS deck URL that Microsoft's servers can fetch without cookies. */
export function classroomOfficeEmbedSrc(deckUrl: string) {
  const embedPath = classroomEmbedDeckUrl(deckUrl);
  return new URL(embedPath, classroomPublicOrigin()).href;
}

export function slideDeckContext(plan: ClassroomPlan, globalSlideIndex: number) {
  const chapters =
    plan.chapters?.length && plan.chapters.length > 0
      ? plan.chapters
      : [
          {
            id: "chapter-1",
            title: plan.title,
            slideStart: 0,
            slideEnd: Math.max(0, plan.slides.length - 1),
            deckUrl: undefined,
          },
        ];

  const chapter = chapters.find(
    (item) =>
      globalSlideIndex >= item.slideStart && globalSlideIndex <= item.slideEnd,
  );
  if (!chapter?.deckUrl) return null;

  return {
    deckUrl: chapter.deckUrl,
    localSlideIndex: globalSlideIndex - chapter.slideStart,
  };
}

function parseClassroomAssetPath(assetPath: string) {
  const chapter = assetPath.match(
    /^classroom\/chapters\/(\d+)\/slides\/(\d+)(?:\/img-(\d+))?$/,
  );
  if (chapter) {
    return {
      chapterPosition: Number(chapter[1]),
      slideIndex: Number(chapter[2]),
      imageIndex: chapter[3] ? Number(chapter[3]) : 0,
    };
  }
  const primary = assetPath.match(/^classroom\/slides\/(\d+)$/);
  if (primary) {
    return { chapterPosition: 1, slideIndex: Number(primary[1]), imageIndex: 0 };
  }
  const secondary = assetPath.match(/^classroom\/slides\/(\d+)\/img-(\d+)$/);
  if (secondary) {
    return {
      chapterPosition: 1,
      slideIndex: Number(secondary[1]),
      imageIndex: Number(secondary[2]),
    };
  }
  return null;
}

export function hydrateClassroomPlan(
  plan: ClassroomPlan,
  slug: string,
  assetPaths: string[] = [],
  options?: { chapterPosition?: number; globalIndexOffset?: number },
): ClassroomPlan {
  const chapterPosition = options?.chapterPosition ?? 1;
  const globalIndexOffset = options?.globalIndexOffset ?? 0;
  const assetsBySlide = new Map<number, Array<{ imageIndex: number }>>();

  for (const assetPath of assetPaths) {
    const parsed = parseClassroomAssetPath(assetPath);
    if (!parsed || parsed.chapterPosition !== chapterPosition) continue;
    const current = assetsBySlide.get(parsed.slideIndex) || [];
    current.push({ imageIndex: parsed.imageIndex });
    assetsBySlide.set(parsed.slideIndex, current);
  }

  const slides = plan.slides.map((slide, localIndex) => {
    const assetEntries = (assetsBySlide.get(localIndex) || assetsBySlide.get(slide.index) || []).sort(
      (a, b) => a.imageIndex - b.imageIndex,
    );
    const hasAsset = assetEntries.length > 0 || slide.imageUrl || slide.imageDataUrl;
    if (!hasAsset) return { ...slide, index: globalIndexOffset + localIndex };

    const imageUrl =
      slide.imageUrl && !slide.imageUrl.startsWith("/api/classroom/")
        ? slide.imageUrl
        : slideAssetUrl(slug, localIndex, 0, chapterPosition);

    return {
      ...slide,
      index: globalIndexOffset + localIndex,
      imageUrl,
      layout: "blueprint" as const,
    };
  });

  return {
    ...plan,
    slides,
  };
}

export function isClassroomPlan(value: unknown): value is ClassroomPlan {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as ClassroomPlan).type === "classroom" &&
    Array.isArray((value as ClassroomPlan).slides)
  );
}

export function visualsSummary(visuals: ClassroomSlideVisual[] | undefined) {
  if (!visuals?.length) return "No labeled visuals on this slide.";
  return visuals
    .map((visual, index) => `- imageIndex ${index}: "${visual.label}"`)
    .join("\n");
}

export function classroomPlanForSlug(slug: string): ClassroomPlan | null {
  if (slug === "demo") return demoClassroomCourse.plan;
  return null;
}

export function classroomCourseForSlug(slug: string): PublicClassroomCourse | null {
  if (slug === "demo") return demoClassroomCourse;
  return null;
}
