"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  Check,
  CheckCircle2,
  Clock3,
} from "lucide-react";
import NarratedExplainer from "@/components/NarratedExplainer";
import type {
  LessonMoment,
  PublicMasonCourse,
} from "@/lib/mason";

const palettes: Record<
  string,
  { ink: string; accent: string; pale: string; dark: string; page: string }
> = {
  heritage: {
    ink: "#10283f",
    accent: "#d9a036",
    pale: "#fff7e1",
    dark: "#10283f",
    page: "#f5f1e8",
  },
  industrial: {
    ink: "#202a32",
    accent: "#e87524",
    pale: "#fff0e6",
    dark: "#202a32",
    page: "#f1f3f4",
  },
  clean: {
    ink: "#243447",
    accent: "#3178c6",
    pale: "#eef6ff",
    dark: "#243447",
    page: "#ffffff",
  },
  field: {
    ink: "#244a3b",
    accent: "#bd7137",
    pale: "#f6e8dd",
    dark: "#244a3b",
    page: "#f3efe3",
  },
};

type CourseSlide =
  | { type: "opening" }
  | { type: "objectives" }
  | { type: "moment"; moment: LessonMoment }
  | { type: "complete" };

function paragraphs(text: string) {
  return text
    .split(/\n\s*\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function SlideActivity({ moment }: { moment: LessonMoment }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const choices = moment.choices || [];
  const correct = selected === moment.correctAnswer;

  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-xs font-black uppercase tracking-[.2em] text-[var(--accent)]">
        {moment.kind === "scenario" ? "Scenario" : "Knowledge check"}
      </p>
      <h2 className="mt-4 text-3xl font-bold tracking-tight text-[var(--ink)] sm:text-5xl">
        {moment.title}
      </h2>
      <p className="mt-5 text-lg leading-8 text-slate-600">{moment.narration}</p>
      {moment.prompt && (
        <p className="mt-6 text-xl font-bold leading-8 text-[var(--ink)]">
          {moment.prompt}
        </p>
      )}
      <div className="mt-6 grid gap-3">
        {choices.map((choice, index) => (
          <button
            key={choice}
            type="button"
            disabled={submitted}
            onClick={() => setSelected(index)}
            className={`flex items-center gap-4 rounded-2xl border p-4 text-left font-semibold transition ${
              selected === index
                ? "border-[var(--accent)] bg-[var(--pale)]"
                : "border-slate-200 bg-white hover:border-slate-400"
            }`}
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-current text-sm">
              {String.fromCharCode(65 + index)}
            </span>
            {choice}
          </button>
        ))}
      </div>
      {!submitted ? (
        <button
          type="button"
          disabled={selected === null}
          onClick={() => setSubmitted(true)}
          className="mt-6 rounded-full bg-[var(--dark)] px-6 py-3 font-bold text-white disabled:opacity-35"
        >
          Check answer
        </button>
      ) : (
        <div
          className={`mt-6 rounded-2xl border p-5 ${
            correct
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-amber-200 bg-amber-50 text-amber-950"
          }`}
        >
          <p className="flex items-center gap-2 font-bold">
            {correct && <CheckCircle2 size={19} />}
            {correct ? "Correct" : "Review this point"}
          </p>
          <p className="mt-2 leading-7">
            {moment.feedback ||
              (correct
                ? "You selected the correct answer."
                : "Return to the explanation and try applying the idea again.")}
          </p>
        </div>
      )}
    </div>
  );
}

export default function SlideshowTrainingPage({
  course,
}: {
  course: PublicMasonCourse;
}) {
  const [sectionIndex, setSectionIndex] = useState(0);
  const [slideIndex, setSlideIndex] = useState(0);
  const section = course.sections[sectionIndex];
  const palette = palettes[course.theme || "heritage"] || palettes.heritage;
  const accent =
    course.accentColor && /^#[0-9a-f]{6}$/i.test(course.accentColor)
      ? course.accentColor
      : palette.accent;

  const slides = useMemo<CourseSlide[]>(
    () => [
      { type: "opening" },
      ...(section.lessonPlan.objectives.length
        ? ([{ type: "objectives" }] as CourseSlide[])
        : []),
      ...section.lessonPlan.moments.map(
        (moment) => ({ type: "moment", moment }) as CourseSlide,
      ),
      { type: "complete" },
    ],
    [section],
  );
  const slide = slides[slideIndex];
  const progress = ((slideIndex + 1) / slides.length) * 100;
  const isFirst = sectionIndex === 0 && slideIndex === 0;
  const isLast =
    sectionIndex === course.sections.length - 1 &&
    slideIndex === slides.length - 1;

  function previous() {
    if (slideIndex > 0) {
      setSlideIndex((current) => current - 1);
    } else if (sectionIndex > 0) {
      const priorSection = course.sections[sectionIndex - 1];
      setSectionIndex((current) => current - 1);
      setSlideIndex(
        1 +
          (priorSection.lessonPlan.objectives.length ? 1 : 0) +
          priorSection.lessonPlan.moments.length,
      );
    }
  }

  function next() {
    if (slideIndex < slides.length - 1) {
      setSlideIndex((current) => current + 1);
    } else if (sectionIndex < course.sections.length - 1) {
      setSectionIndex((current) => current + 1);
      setSlideIndex(0);
    }
  }

  return (
    <main
      data-course-theme={course.theme || "heritage"}
      className="course-shell slideshow-course min-h-screen bg-[var(--page)] text-slate-800"
      style={
        {
          "--ink": palette.ink,
          "--accent": accent,
          "--pale": palette.pale,
          "--dark": palette.dark,
          "--page": palette.page,
        } as React.CSSProperties
      }
    >
      <header className="border-b border-white/10 bg-[var(--dark)] text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-5 py-4 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            {course.logoData ? (
              <span className="flex h-11 w-32 items-center rounded-lg bg-white p-1.5">
                <Image
                  src={course.logoData}
                  alt={`${course.companyName || course.title} logo`}
                  width={128}
                  height={44}
                  unoptimized
                  className="max-h-8 w-auto max-w-full object-contain"
                />
              </span>
            ) : (
              <BookOpen className="shrink-0 text-[var(--accent)]" size={24} />
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{course.title}</p>
              <p className="truncate text-xs text-white/45">
                {course.companyName || "Training program"}
              </p>
            </div>
          </div>
          <div className="hidden items-center gap-2 text-xs font-semibold text-white/55 sm:flex">
            <Clock3 size={15} />
            {section.estimatedMinutes || 15} min · Section {sectionIndex + 1} of{" "}
            {course.sections.length}
          </div>
        </div>
        <div className="h-1 bg-white/10">
          <span
            className="block h-full bg-[var(--accent)] transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

      <div className="mx-auto flex min-h-[calc(100vh-146px)] max-w-7xl items-center px-4 py-6 sm:px-8 sm:py-10">
        <section className="w-full overflow-y-auto rounded-3xl border border-slate-200/80 bg-white/90 shadow-[0_28px_80px_rgba(15,23,42,.14)]">
          <div className="max-h-[calc(100vh-210px)] min-h-[560px] overflow-y-auto px-6 py-10 sm:px-12 lg:px-16 lg:py-14">
            {slide.type === "opening" && (
              <div className="mx-auto flex min-h-[430px] max-w-4xl flex-col justify-center">
                <p className="text-xs font-black uppercase tracking-[.22em] text-[var(--accent)]">
                  Section {String(sectionIndex + 1).padStart(2, "0")}
                </p>
                <h1 className="mt-5 text-4xl font-bold leading-[1.05] tracking-[-.04em] text-[var(--ink)] sm:text-6xl">
                  {section.lessonPlan.sectionTitle || section.title}
                </h1>
                <p className="mt-7 max-w-3xl text-xl leading-9 text-slate-600 sm:text-2xl">
                  {section.lessonPlan.opening}
                </p>
              </div>
            )}

            {slide.type === "objectives" && (
              <div className="mx-auto max-w-4xl">
                <p className="text-xs font-black uppercase tracking-[.22em] text-[var(--accent)]">
                  Learning objectives
                </p>
                <h2 className="mt-4 text-4xl font-bold tracking-tight text-[var(--ink)] sm:text-5xl">
                  What you will learn
                </h2>
                <div className="mt-9 grid gap-4 sm:grid-cols-2">
                  {section.lessonPlan.objectives.map((objective) => (
                    <div
                      key={objective}
                      className="flex gap-4 rounded-2xl bg-[var(--pale)] p-5"
                    >
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--dark)] text-white">
                        <Check size={15} strokeWidth={3} />
                      </span>
                      <p className="font-semibold leading-7 text-[var(--ink)]">
                        {objective}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {slide.type === "moment" &&
              (slide.moment.kind === "question" ||
              slide.moment.kind === "scenario" ? (
                <SlideActivity
                  key={`${section.id}-${slideIndex}`}
                  moment={slide.moment}
                />
              ) : slide.moment.kind === "visual" ? (
                <div className="mx-auto max-w-4xl">
                  <NarratedExplainer moment={slide.moment} />
                </div>
              ) : (
                <div className="mx-auto flex min-h-[430px] max-w-4xl flex-col justify-center">
                  <p className="text-xs font-black uppercase tracking-[.2em] text-[var(--accent)]">
                    {slide.moment.kind === "summary" ? "Key takeaway" : "Learn"}
                  </p>
                  <h2 className="mt-4 text-4xl font-bold tracking-tight text-[var(--ink)] sm:text-5xl">
                    {slide.moment.title}
                  </h2>
                  <div className="mt-7 max-w-3xl space-y-5">
                    {paragraphs(slide.moment.narration).map((paragraph) => (
                      <p key={paragraph} className="text-xl leading-9 text-slate-600">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </div>
              ))}

            {slide.type === "complete" && (
              <div className="mx-auto flex min-h-[430px] max-w-3xl flex-col items-center justify-center text-center">
                <span className="grid h-20 w-20 place-items-center rounded-full bg-[var(--pale)] text-[var(--accent)]">
                  {isLast ? <Award size={38} /> : <CheckCircle2 size={38} />}
                </span>
                <p className="mt-7 text-xs font-black uppercase tracking-[.22em] text-[var(--accent)]">
                  {isLast ? "Course complete" : "Section complete"}
                </p>
                <h2 className="mt-4 text-4xl font-bold tracking-tight text-[var(--ink)] sm:text-5xl">
                  {isLast ? "You reached the finish." : "Ready for the next section?"}
                </h2>
                <p className="mt-5 text-lg leading-8 text-slate-600">
                  {isLast
                    ? section.lessonPlan.summary
                    : "Continue when you are ready, or go back to review any topic."}
                </p>
              </div>
            )}
          </div>
        </section>
      </div>

      <footer className="sticky bottom-0 border-t border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <button
            type="button"
            onClick={previous}
            disabled={isFirst}
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-5 py-2.5 text-sm font-bold text-[var(--ink)] disabled:opacity-30"
          >
            <ArrowLeft size={17} /> Previous
          </button>
          <p className="hidden text-xs font-bold uppercase tracking-[.16em] text-slate-400 sm:block">
            Slide {slideIndex + 1} of {slides.length}
          </p>
          <button
            type="button"
            onClick={next}
            disabled={isLast}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--dark)] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-30"
          >
            {isLast ? "Complete" : "Next"} <ArrowRight size={17} />
          </button>
        </div>
      </footer>
    </main>
  );
}
