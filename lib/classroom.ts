export type ClassroomSlide = {
  index: number;
  title: string;
  bodyText: string;
  speakerNotes: string;
  imageDataUrl: string;
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
};

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

function svgDataUrl(svg: string) {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

const demoSlides: ClassroomSlide[] = [
  {
    index: 0,
    title: "Why ladder safety matters",
    bodyText:
      "Falls from ladders are one of the most common serious injuries on job sites. Most incidents happen during routine tasks, not dramatic failures.",
    speakerNotes:
      "Open with a question: ask what the learner has seen on a job site before explaining statistics.",
    imageDataUrl: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
        <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#7dd3fc"/><stop offset="100%" stop-color="#e0f2fe"/></linearGradient></defs>
        <rect width="960" height="540" fill="url(#sky)"/>
        <rect y="400" width="960" height="140" fill="#64748b"/>
        <rect x="420" y="120" width="18" height="280" fill="#f59e0b" transform="rotate(12 429 400)"/>
        <rect x="500" y="80" width="220" height="160" fill="#94a3b8"/>
        <text x="48" y="72" fill="#0f172a" font-family="Arial,sans-serif" font-size="34" font-weight="700">Ladder Safety on the Job</text>
        <text x="48" y="470" fill="#f8fafc" font-family="Arial,sans-serif" font-size="22">Inspect • Position • Secure</text>
      </svg>`),
  },
  {
    index: 1,
    title: "The 4-to-1 rule",
    bodyText:
      "For every four feet of working height, the ladder base should sit one foot away from the wall. This angle keeps the ladder stable.",
    speakerNotes:
      "Walk through a quick example with a 16-foot working height. Ask the learner to predict the base distance before revealing the answer.",
    imageDataUrl: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
        <rect width="960" height="540" fill="#f8fafc"/>
        <line x1="120" y1="420" x2="760" y2="420" stroke="#cbd5e1" stroke-width="4"/>
        <line x1="760" y1="120" x2="760" y2="420" stroke="#94a3b8" stroke-width="8"/>
        <line x1="520" y1="420" x2="760" y2="180" stroke="#f59e0b" stroke-width="10"/>
        <text x="600" y="455" fill="#0f172a" font-family="Arial,sans-serif" font-size="28">4 ft base</text>
        <text x="780" y="280" fill="#0f172a" font-family="Arial,sans-serif" font-size="28">16 ft height</text>
        <text x="48" y="72" fill="#0f172a" font-family="Arial,sans-serif" font-size="34" font-weight="700">4-to-1 Angle</text>
      </svg>`),
  },
  {
    index: 2,
    title: "Three-point contact",
    bodyText:
      "Keep three points of contact while climbing: two hands and one foot, or two feet and one hand. Carry tools on a belt or hoist them up.",
    speakerNotes:
      "Use a scenario: learner is carrying a drill while climbing. Ask whether that setup is acceptable.",
    imageDataUrl: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
        <rect width="960" height="540" fill="#ecfeff"/>
        <rect x="430" y="90" width="20" height="330" fill="#f59e0b"/>
        <circle cx="445" cy="170" r="16" fill="#0f172a"/>
        <circle cx="470" cy="220" r="16" fill="#0f172a"/>
        <circle cx="420" cy="260" r="16" fill="#0f172a"/>
        <text x="48" y="72" fill="#0f172a" font-family="Arial,sans-serif" font-size="34" font-weight="700">Three-Point Contact</text>
        <text x="48" y="120" fill="#334155" font-family="Arial,sans-serif" font-size="24">Two hands + one foot, or two feet + one hand</text>
      </svg>`),
  },
  {
    index: 3,
    title: "When to stop and reassess",
    bodyText:
      "Stop work when the surface is unstable, weather changes, the ladder is damaged, or you feel rushed. A reset is faster than an injury.",
    speakerNotes:
      "Close by asking the learner to name one situation where they would pause and reassess.",
    imageDataUrl: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
        <rect width="960" height="540" fill="#fff7ed"/>
        <rect x="80" y="120" width="800" height="280" rx="24" fill="#ffffff" stroke="#fdba74"/>
        <text x="120" y="190" fill="#9a3412" font-family="Arial,sans-serif" font-size="30" font-weight="700">Pause when:</text>
        <text x="120" y="240" fill="#7c2d12" font-family="Arial,sans-serif" font-size="24">• Ground is soft or uneven</text>
        <text x="120" y="280" fill="#7c2d12" font-family="Arial,sans-serif" font-size="24">• Weather shifts suddenly</text>
        <text x="120" y="320" fill="#7c2d12" font-family="Arial,sans-serif" font-size="24">• Ladder shows damage or wobble</text>
        <text x="120" y="360" fill="#7c2d12" font-family="Arial,sans-serif" font-size="24">• You feel rushed or unsure</text>
      </svg>`),
  },
];

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
  },
};

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
