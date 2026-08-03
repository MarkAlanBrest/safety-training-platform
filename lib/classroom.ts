import type { ClassroomBuilderConfig } from "@/lib/classroom-builder";
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

export type ClassroomSlide = {
  index: number;
  title: string;
  bodyText: string;
  speakerNotes: string;
  subtitle?: string;
  bullets?: string[];
  highlight?: string;
  layout?: "title" | "content" | "image" | "split";
  imageDataUrl?: string;
  imageUrl?: string;
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
  slides: ClassroomSlide[];
  checkpoints?: ClassroomCheckpoint[];
  assessment?: ClassroomAssessmentQuestion[];
  lessonBeats?: ClassroomLessonBeat[];
  config?: ClassroomBuilderConfig;
};

export type { ClassroomCheckpoint, ClassroomAssessmentQuestion, ClassroomLessonBeat };

export type PresentationView =
  | {
      type: "slide";
      slideIndex: number;
      headline?: string;
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
  },
  {
    index: 1,
    title: "The 4-to-1 rule",
    bodyText:
      "For every four feet of working height, the ladder base should sit one foot away from the wall. This angle keeps the ladder stable.",
    speakerNotes:
      "Walk through a quick example with a 16-foot working height. Ask the learner to predict the base distance before revealing the answer.",
    imageUrl: demoSlideImages[1],
  },
  {
    index: 2,
    title: "Three-point contact",
    bodyText:
      "Keep three points of contact while climbing: two hands and one foot, or two feet and one hand. Carry tools on a belt or hoist them up.",
    speakerNotes:
      "Use a scenario: learner is carrying a drill while climbing. Ask whether that setup is acceptable.",
    imageUrl: demoSlideImages[2],
  },
  {
    index: 3,
    title: "When to stop and reassess",
    bodyText:
      "Stop work when the surface is unstable, weather changes, the ladder is damaged, or you feel rushed. A reset is faster than an injury.",
    speakerNotes:
      "Close by asking the learner to name one situation where they would pause and reassess.",
    imageUrl: demoSlideImages[3],
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

export function slideImageSrc(slide: ClassroomSlide) {
  return slide.imageUrl || slide.imageDataUrl || "";
}

export function classroomSlideAssetPath(index: number) {
  return `classroom/slides/${index}`;
}

export function isClassroomPlan(value: unknown): value is ClassroomPlan {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as ClassroomPlan).type === "classroom" &&
    Array.isArray((value as ClassroomPlan).slides)
  );
}

export function classroomPlanForSlug(slug: string): ClassroomPlan | null {
  if (slug === "demo") return demoClassroomCourse.plan;
  return null;
}

export function classroomCourseForSlug(slug: string): PublicClassroomCourse | null {
  if (slug === "demo") return demoClassroomCourse;
  return null;
}
