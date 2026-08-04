import type { ClassroomChapter, ClassroomPlan, ClassroomSlide, ClassroomTopic } from "@/lib/classroom";
import {
  buildFallbackAssessment,
  buildFallbackCheckpoints,
  buildLessonBeats,
} from "@/lib/classroom-lesson";

export type { ClassroomChapter };

export type ClassroomSectionRecord = {
  id: number;
  title: string;
  position: number;
  plan: ClassroomPlan;
};

export function classroomChapterSlideAssetPath(
  chapterPosition: number,
  slideIndex: number,
) {
  return chapterPosition <= 1
    ? `classroom/slides/${slideIndex}`
    : `classroom/chapters/${chapterPosition}/slides/${slideIndex}`;
}

export function classroomPlanFromSections(
  courseTitle: string,
  sections: ClassroomSectionRecord[],
): ClassroomPlan {
  if (!sections.length) {
    return {
      type: "classroom",
      title: courseTitle,
      opening: "Welcome to class.",
      objectives: ["Understand the lesson material"],
      topics: [],
      chapters: [],
      slides: [],
      lessonBeats: [{ kind: "welcome" }],
    };
  }

  if (sections.length === 1) {
    const plan = sections[0].plan;
    return {
      ...plan,
      title: courseTitle || plan.title,
      chapters: [
        {
          id: `chapter-${sections[0].position}`,
          sectionId: sections[0].id,
          title: sections[0].title || plan.title,
          slideStart: 0,
          slideEnd: Math.max(0, plan.slides.length - 1),
        },
      ],
    };
  }

  const slides: ClassroomSlide[] = [];
  const chapters: ClassroomChapter[] = [];
  const topics: ClassroomTopic[] = [];
  let offset = 0;

  for (const section of sections) {
    const slideStart = offset;
    const chapterSlides = section.plan.slides.map((slide) => {
      const nextSlide = { ...slide, index: offset };
      offset += 1;
      return nextSlide;
    });
    const slideEnd = offset - 1;
    chapters.push({
      id: `chapter-${section.position}`,
      sectionId: section.id,
      title: section.title || section.plan.title,
      slideStart,
      slideEnd,
    });
    topics.push({
      id: `chapter-${section.position}`,
      title: section.title || section.plan.title,
      slideStart,
      slideEnd,
    });
    slides.push(...chapterSlides);
  }

  let checkpointOffset = 0;
  const checkpoints = [];
  const assessment = [];
  for (const section of sections) {
    for (const checkpoint of section.plan.checkpoints || []) {
      checkpoints.push({ ...checkpoint, slideIndex: checkpoint.slideIndex + checkpointOffset });
    }
    for (const question of section.plan.assessment || []) {
      assessment.push(question);
    }
    checkpointOffset += section.plan.slides.length;
  }

  const config = sections[0].plan.config;
  const merged: ClassroomPlan = {
    type: "classroom",
    title: courseTitle || sections[0].plan.title,
    opening: sections[0].plan.opening,
    objectives: sections[0].plan.objectives,
    topics,
    chapters,
    slides,
    checkpoints: checkpoints.length
      ? checkpoints
      : buildFallbackCheckpoints(slides, config),
    assessment: assessment.length
      ? assessment
      : buildFallbackAssessment(slides, config),
    config,
  };
  merged.lessonBeats = buildLessonBeats(merged);
  return merged;
}
