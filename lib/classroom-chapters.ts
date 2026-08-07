import type { ClassroomChapter, ClassroomLessonBeat, ClassroomPlan, ClassroomSlide, ClassroomTopic } from "@/lib/classroom";
import {
  buildFallbackAssessment,
  buildFallbackCheckpoints,
  buildLessonBeats,
} from "@/lib/classroom-lesson";
import {
  attachSlideIndicesToLineup,
  buildLessonBeatsFromLineup,
  type LessonLineupItem,
} from "@/lib/classroom-lineup";

export type { ClassroomChapter };

export type ClassroomSectionRecord = {
  id: number;
  title: string;
  position: number;
  plan: ClassroomPlan;
  deckUrl?: string;
};

export function classroomChapterDeckAssetPath(chapterPosition: number) {
  return chapterPosition <= 1
    ? "classroom/deck.pptx"
    : `classroom/chapters/${chapterPosition}/deck.pptx`;
}

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
          deckUrl: sections[0].deckUrl,
          finalTest: plan.finalTest,
        },
      ],
    };
  }

  const slides: ClassroomSlide[] = [];
  const chapters: ClassroomChapter[] = [];
  const topics: ClassroomTopic[] = [];
  const lineup: LessonLineupItem[] = [];
  const lessonBeats: ClassroomLessonBeat[] = [];
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
      deckUrl: section.deckUrl,
      finalTest: section.plan.finalTest,
    });
    topics.push({
      id: `chapter-${section.position}`,
      title: section.title || section.plan.title,
      slideStart,
      slideEnd,
    });
    slides.push(...chapterSlides);
    if (section.plan.lineup?.length) lineup.push(...section.plan.lineup);

    const localBeats = section.plan.lessonBeats || buildLessonBeats(section.plan);
    for (const beat of localBeats) {
      if (beat.kind === "welcome") continue;
      if (beat.kind === "slide") {
        lessonBeats.push({ kind: "slide" as const, slideIndex: slideStart + beat.slideIndex });
      } else if (beat.kind === "finalTest") {
        lessonBeats.push({ kind: "chapterTest" as const, chapterIndex: chapters.length - 1 });
      } else {
        lessonBeats.push(beat);
      }
    }
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
    lineup: lineup.length ? attachSlideIndicesToLineup(lineup) : undefined,
    config,
  };
  merged.lessonBeats = lessonBeats.length
    ? lessonBeats
    : merged.lineup?.length
      ? buildLessonBeatsFromLineup(merged.lineup, {
          hasAssessment: Boolean(merged.assessment?.length),
        })
      : buildLessonBeats(merged);
  return merged;
}
