import type { GeneratedAiCourse } from "@/lib/ai-course-generator";
import type { LessonMoment } from "@/lib/mason";

const IMAGE_TIMEOUT_MS = 150_000;

type ImageResponse = {
  data?: Array<{ b64_json?: string }>;
  error?: { message?: string; code?: string };
};

async function generateCoursePicture(prompt: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_TIMEOUT_MS);
  try {
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
        prompt: [
          "Create a realistic, natural professional training photograph for an adult online course.",
          "The scene must be physically plausible, instructionally useful, and visually clear at landscape presentation size.",
          "Use believable people, equipment, environment, lighting, and personal protective equipment when appropriate.",
          "Do not include visible words, captions, labels, logos, watermarks, brand marks, graphic injuries, or decorative borders.",
          prompt.trim(),
        ].join("\n"),
        n: 1,
        size: "1536x1024",
        quality: "medium",
        output_format: "jpeg",
        output_compression: 72,
        background: "opaque",
      }),
    });
    const data = (await response.json()) as ImageResponse;
    if (!response.ok || !data.data?.[0]?.b64_json) {
      throw new Error(data.error?.message || "The course picture could not be generated.");
    }
    return `data:image/jpeg;base64,${data.data[0].b64_json}`;
  } finally {
    clearTimeout(timeout);
  }
}

type VisualTarget = {
  sectionIndex: number;
  momentIndex: number;
  moment: LessonMoment;
};

/** Add one meaningful, editable photograph per chapter without allowing a failed image to block the course. */
export async function addGeneratedCoursePictures(course: GeneratedAiCourse) {
  const targets: VisualTarget[] = [];
  course.sections.forEach((section, sectionIndex) => {
    const momentIndex = section.lessonPlan.moments.findIndex(
      (moment) => moment.kind === "visual" && Boolean(moment.imagePrompt?.trim()),
    );
    if (momentIndex >= 0) {
      targets.push({ sectionIndex, momentIndex, moment: section.lessonPlan.moments[momentIndex] });
    }
  });

  const results = await Promise.allSettled(
    targets.map((target) => generateCoursePicture(target.moment.imagePrompt || target.moment.title)),
  );

  results.forEach((result, index) => {
    const target = targets[index];
    if (result.status !== "fulfilled") {
      console.error("AI course picture generation failed:", result.reason);
      return;
    }
    const moment = course.sections[target.sectionIndex].lessonPlan.moments[target.momentIndex];
    const frame = moment.explainerFrames?.[0];
    if (frame) frame.sourceImage = result.value;
    moment.sourceImage = result.value;
  });

  return course;
}
