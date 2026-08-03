"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Award,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  Menu,
  X,
} from "lucide-react";
import VisualSlide from "@/components/training/VisualSlide";
import ReadingSlide from "@/components/training/ReadingSlide";
import {
  DragOrderActivity,
  ImpactTiles,
} from "@/components/training/ImpactBlocks";
import {
  buildPlayerFrames,
  type LessonMoment,
  type PublicMasonCourse,
} from "@/lib/mason";
import SlideshowTrainingPage from "@/components/SlideshowTrainingPage";

type Answer = { selected: number; submitted: boolean };

const themes: Record<
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

function paragraphs(text: string) {
  const blocks = text
    .split(/\n\s*\n/)
    .map((item) => item.trim())
    .filter(Boolean);
  return blocks.length ? blocks : [text];
}

function Activity({
  moment,
  index,
  answer,
  onAnswer,
}: {
  moment: LessonMoment;
  index: number;
  answer?: Answer;
  onAnswer: (index: number, answer: Answer) => void;
}) {
  if (!moment.choices?.length || !moment.prompt) return null;
  const correct = answer?.selected === moment.correctAnswer;

  return (
    <section className="my-14 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_50px_rgba(30,41,59,.08)]">
      <div className="border-b border-slate-100 px-6 py-5 sm:px-9">
        <p className="mb-2 text-xs font-bold uppercase tracking-[.2em] text-[var(--accent)]">
          Apply what you learned
        </p>
        <h3 className="text-2xl font-semibold leading-tight text-[var(--ink)]">
          {moment.title}
        </h3>
      </div>
      <div className="px-6 py-7 sm:px-9">
        {moment.narration && (
          <p className="mb-5 text-[17px] leading-8 text-slate-600">{moment.narration}</p>
        )}
        <p className="mb-5 text-lg font-semibold leading-7 text-slate-900">{moment.prompt}</p>
        <div className="space-y-3">
          {moment.choices.map((choice, choiceIndex) => {
            const selected = answer?.selected === choiceIndex;
            return (
              <button
                key={choice}
                type="button"
                disabled={answer?.submitted}
                onClick={() => onAnswer(index, { selected: choiceIndex, submitted: false })}
                className={`flex w-full items-start gap-3 rounded-xl border px-4 py-4 text-left transition ${
                  selected
                    ? "border-[var(--accent)] bg-[var(--pale)]"
                    : "border-slate-200 hover:border-slate-400 hover:bg-slate-50"
                } disabled:cursor-default`}
              >
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-current text-xs font-bold">
                  {String.fromCharCode(65 + choiceIndex)}
                </span>
                <span className="leading-6">{choice}</span>
              </button>
            );
          })}
        </div>
        {!answer?.submitted ? (
          <button
            type="button"
            disabled={!answer}
            onClick={() => answer && onAnswer(index, { ...answer, submitted: true })}
            className="mt-6 rounded-full bg-[var(--dark)] px-6 py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35"
          >
            Check answer
          </button>
        ) : (
          <div
            className={`mt-6 rounded-xl border-l-4 p-5 ${
              correct
                ? "border-emerald-600 bg-emerald-50 text-emerald-950"
                : "border-amber-500 bg-amber-50 text-amber-950"
            }`}
          >
            <p className="font-bold">{correct ? "That’s right." : "Take another look."}</p>
            <p className="mt-1 leading-7">
              {moment.feedback ||
                (correct
                  ? "You applied the concept correctly."
                  : "Review the explanation above, then try the idea in a new context.")}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function MasteryCheck({
  moments,
  onComplete,
  finalExam = false,
}: {
  moments: LessonMoment[];
  onComplete: (score: number, answers: number[]) => void;
  finalExam?: boolean;
}) {
  const [started, setStarted] = useState(false);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const scored = moments.filter((moment) => moment.choices?.length && moment.correctAnswer !== null);
  const score = scored.reduce(
    (total, moment, index) => total + (answers[index] === moment.correctAnswer ? 1 : 0),
    0,
  );
  const percentage = scored.length ? Math.round((score / scored.length) * 100) : 0;
  const passed = percentage >= 80;

  if (!started) {
    return (
      <section className="my-20 rounded-3xl bg-[var(--dark)] px-7 py-10 text-white sm:px-12 sm:py-14">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-white/60">
          {finalExam ? "Final assessment" : "End of section"}
        </p>
        <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">
          {finalExam ? "Ready for the final exam?" : "Ready to check your mastery?"}
        </h2>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-white/75">
          {finalExam
            ? "Answer every question independently. A score of 80% or higher is required to complete the course and earn your certificate."
            : "This is the independent part. Narration and coaching are paused while you demonstrate what you know."}
        </p>
        <button
          type="button"
          onClick={() => setStarted(true)}
          className="mt-7 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 font-bold text-[var(--dark)]"
        >
          {finalExam ? "Begin final exam" : "Begin mastery check"} <ArrowRight size={17} />
        </button>
      </section>
    );
  }

  return (
    <section className="my-20 border-y border-slate-300 py-12">
      <p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--accent)]">
        {finalExam ? "Final exam" : "Mastery check"}
      </p>
      <h2 className="mt-2 text-3xl font-semibold text-[var(--ink)]">Work independently</h2>
      <p className="mt-3 text-slate-600">Passing score: 80%</p>
      <div className="mt-9 space-y-10">
        {scored.map((moment, index) => (
          <div key={`${moment.title}-${index}`}>
            <p className="text-lg font-semibold leading-7 text-slate-900">
              {index + 1}. {moment.prompt || moment.title}
            </p>
            <div className="mt-4 grid gap-3">
              {moment.choices?.map((choice, choiceIndex) => (
                <button
                  key={choice}
                  type="button"
                  disabled={submitted}
                  onClick={() => setAnswers((current) => ({ ...current, [index]: choiceIndex }))}
                  className={`rounded-xl border px-4 py-3 text-left ${
                    answers[index] === choiceIndex
                      ? "border-[var(--accent)] bg-[var(--pale)]"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  {choice}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {!submitted ? (
        <button
          type="button"
          disabled={Object.keys(answers).length !== scored.length}
          onClick={() => {
            setSubmitted(true);
            if (percentage >= 80) onComplete(percentage, scored.map((_, index) => answers[index]));
          }}
          className="mt-9 rounded-full bg-[var(--dark)] px-7 py-3 font-bold text-white disabled:opacity-35"
        >
          Submit mastery check
        </button>
      ) : (
        <div className={`mt-9 rounded-2xl p-6 ${passed ? "bg-emerald-50" : "bg-amber-50"}`}>
          <p className="text-xl font-bold text-[var(--ink)]">
            {score} of {scored.length} correct · {percentage}%
          </p>
          <p className="mt-2 text-slate-700">
            {passed
              ? finalExam
                ? "Passed. Your completion is being recorded and your certificate is ready below."
                : "Section complete. You demonstrated the objective independently."
              : "You need 80% to pass. Review the section, then try again when you are ready."}
          </p>
          {!passed && (
            <button
              type="button"
              onClick={() => {
                setAnswers({});
                setSubmitted(false);
              }}
              className="mt-5 rounded-full bg-[var(--dark)] px-6 py-2.5 font-bold text-white"
            >
              Retake assessment
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function WebpageTrainingPage({ course }: { course: PublicMasonCourse }) {
  const searchParams = useSearchParams();
  const enrollmentCode = searchParams?.get("code") || "";
  const [sectionIndex, setSectionIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [answers, setAnswers] = useState<Record<number, Answer>>({});
  const [complete, setComplete] = useState<number[]>([]);
  const [certificateUrl, setCertificateUrl] = useState("");
  const [completionError, setCompletionError] = useState("");
  const [recordingCompletion, setRecordingCompletion] = useState(false);
  const section = course.sections[sectionIndex];
  const palette = themes[course.theme || "heritage"] || themes.heritage;
  const accentColor =
    course.accentColor && /^#[0-9a-f]{6}$/i.test(course.accentColor)
      ? course.accentColor
      : palette.accent;

  const mastery = useMemo(() => {
    const explicit = section.lessonPlan.moments.filter((moment) => moment.phase === "mastery");
    if (explicit.length) return explicit;
    return section.lessonPlan.moments
      .filter((moment) => moment.kind === "question" || moment.kind === "scenario")
      .slice(-1);
  }, [section]);
  const masterySet = new Set(mastery);
  const learningMoments = section.lessonPlan.moments.filter((moment) => !masterySet.has(moment));
  const totalMinutes =
    section.estimatedMinutes ||
    Math.max(10, Math.round((course.estimatedMinutes || 60) / Math.max(course.sections.length, 1)));

  function changeSection(index: number) {
    setSectionIndex(index);
    setAnswers({});
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function finishSection(_score: number, examAnswers: number[]) {
    setComplete((current) =>
      current.includes(sectionIndex) ? current : [...current, sectionIndex],
    );

    if (sectionIndex !== course.sections.length - 1) return;
    if (!enrollmentCode) {
      setCompletionError("Open this course with your enrollment code to record completion and earn a certificate.");
      return;
    }

    setRecordingCompletion(true);
    setCompletionError("");
    try {
      const response = await fetch("/api/training/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: enrollmentCode, courseSlug: course.slug, answers: examAnswers }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Completion could not be recorded.");
      setCertificateUrl(data.certificateUrl);
    } catch (error) {
      setCompletionError(error instanceof Error ? error.message : "Completion could not be recorded.");
    } finally {
      setRecordingCompletion(false);
    }
  }

  return (
    <main
      style={
        {
          "--ink": palette.ink,
          "--accent": accentColor,
          "--pale": palette.pale,
          "--dark": palette.dark,
          "--page": palette.page,
          "--visual-accent": accentColor,
          "--visual-bg": palette.dark,
          "--visual-dark": palette.dark,
        } as React.CSSProperties
      }
      data-course-theme={course.theme || "heritage"}
      className="course-shell min-h-screen bg-[var(--page)] text-slate-800"
    >
      <button
        type="button"
        onClick={() => setMenuOpen(true)}
        className="fixed left-4 top-4 z-40 grid h-11 w-11 place-items-center rounded-full bg-[var(--dark)] text-white shadow-lg lg:hidden"
        aria-label="Open course menu"
      >
        <Menu size={20} />
      </button>

      <aside
        className={`course-sidebar fixed inset-y-0 left-0 z-50 w-[290px] border-r border-white/10 bg-[var(--dark)] text-white transition-transform lg:translate-x-0 ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-white/10 px-7 py-8">
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="absolute right-4 top-4 text-white/70 lg:hidden"
              aria-label="Close course menu"
            >
              <X size={20} />
            </button>
            {course.logoData ? (
              <span className="mb-5 flex h-16 w-full items-center rounded-xl bg-white p-2">
                <Image
                  src={course.logoData}
                  alt={`${course.companyName || course.title} logo`}
                  width={220}
                  height={64}
                  unoptimized
                  className="max-h-12 w-auto max-w-full object-contain"
                />
              </span>
            ) : (
              <BookOpen className="mb-5 text-[var(--accent)]" size={25} />
            )}
            <p className="text-xs font-bold uppercase tracking-[.18em] text-white/50">
              {course.companyName || "Training program"}
            </p>
            <h1 className="mt-2 text-xl font-semibold leading-7">{course.title}</h1>
          </div>
          <nav className="flex-1 overflow-y-auto px-4 py-6">
            <p className="px-3 text-xs font-bold uppercase tracking-[.16em] text-white/40">Sections</p>
            <div className="mt-3 space-y-1">
              {course.sections.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => changeSection(index)}
                  className={`flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition ${
                    index === sectionIndex ? "bg-white text-[var(--dark)]" : "text-white/72 hover:bg-white/8"
                  }`}
                >
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center">
                    {complete.includes(index) ? (
                      <CheckCircle2 size={20} className="text-emerald-500" />
                    ) : (
                      <span className="text-sm font-bold opacity-55">{String(index + 1).padStart(2, "0")}</span>
                    )}
                  </span>
                  <span className="text-sm font-semibold leading-6">{item.title}</span>
                </button>
              ))}
            </div>
          </nav>
          <div className="border-t border-white/10 px-7 py-5 text-xs text-white/45">
            {complete.length} of {course.sections.length} sections complete
          </div>
        </div>
      </aside>

      <div className="lg:pl-[290px]">
        <header className="course-topbar sticky top-0 z-30 border-b border-slate-200/80 bg-[color:var(--page)]/95 backdrop-blur">
          <div className="mx-auto flex max-w-[1050px] items-center justify-between gap-4 px-6 py-4 pl-20 lg:px-14">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[var(--ink)]">{section.title}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                Section {sectionIndex + 1} of {course.sections.length}
              </p>
            </div>
            <span className="flex shrink-0 items-center gap-2 text-sm text-slate-500">
              <Clock3 size={16} /> About {totalMinutes} min
            </span>
          </div>
        </header>

        <article className="course-article mx-auto max-w-[1050px] px-6 pb-24 pt-14 sm:px-10 lg:px-14 lg:pt-20">
          <div className="max-w-[790px]">
            <p className="text-xs font-bold uppercase tracking-[.24em] text-[var(--accent)]">
              Section {String(sectionIndex + 1).padStart(2, "0")}
            </p>
            <h1 className="mt-5 text-4xl font-semibold leading-[1.08] tracking-[-.035em] text-[var(--ink)] sm:text-6xl">
              {section.lessonPlan.sectionTitle || section.title}
            </h1>
            <p className="mt-7 text-xl leading-9 text-slate-600 sm:text-2xl sm:leading-10">
              {section.lessonPlan.opening}
            </p>
          </div>

          {!!section.lessonPlan.objectives.length && (
            <div className="my-14 border-y border-slate-300 py-8">
              <p className="text-xs font-bold uppercase tracking-[.18em] text-slate-500">What you will learn</p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {section.lessonPlan.objectives.map((objective) => (
                  <div key={objective} className="flex gap-3">
                    <Check className="mt-1 shrink-0 text-[var(--accent)]" size={18} />
                    <p className="leading-7 text-slate-700">{objective}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="max-w-[850px]">
            {learningMoments.map((moment, index) => {
              if (moment.kind === "question" || moment.kind === "scenario") {
                return (
                  <Activity
                    key={`${moment.title}-${index}`}
                    moment={moment}
                    index={index}
                    answer={answers[index]}
                    onAnswer={(answerIndex, answer) =>
                      setAnswers((current) => ({ ...current, [answerIndex]: answer }))
                    }
                  />
                );
              }

              if (moment.kind === "visual") {
                return (
                  <div
                    key={`${moment.title}-${index}`}
                    className="mx-auto my-12 w-full max-w-[760px]"
                  >
                    <VisualSlide
                      frames={moment.playerFrames ?? buildPlayerFrames(moment)}
                      courseSlug={course.slug}
                    />
                  </div>
                );
              }

              if (moment.kind === "tiles") {
                return <ImpactTiles key={`${moment.title}-${index}`} moment={moment} />;
              }

              if (moment.kind === "dragdrop") {
                return (
                  <DragOrderActivity
                    key={`${moment.title}-${index}`}
                    moment={moment}
                  />
                );
              }

              if (moment.kind === "summary") {
                return (
                  <ReadingSlide
                    key={`${moment.title}-${index}`}
                    title={moment.title}
                    narration={moment.narration}
                    variant="summary"
                  />
                );
              }

              if (moment.kind === "explain" || moment.kind === "text") {
                return (
                  <ReadingSlide
                    key={`${moment.title}-${index}`}
                    title={moment.title}
                    narration={moment.narration}
                    variant="learn"
                  />
                );
              }

              return (
                <section key={`${moment.title}-${index}`} className="my-14 max-w-[760px]">
                  <h2 className="text-3xl font-semibold tracking-tight text-[var(--ink)] sm:text-4xl">
                    {moment.title}
                  </h2>
                  {paragraphs(moment.narration).map((text, paragraphIndex) => (
                    <p key={paragraphIndex} className="mt-5 text-lg leading-8 text-slate-700">{text}</p>
                  ))}
                </section>
              );
            })}
          </div>

          {!!section.lessonPlan.keyFacts.length && (
            <section className="my-16 max-w-[800px]">
              <p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--accent)]">Keep these in mind</p>
              <div className="mt-5 border-t border-slate-300">
                {section.lessonPlan.keyFacts.map((fact, index) => (
                  <div key={fact} className="flex gap-5 border-b border-slate-300 py-5">
                    <span className="font-semibold text-[var(--accent)]">{String(index + 1).padStart(2, "0")}</span>
                    <p className="text-lg leading-7 text-slate-700">{fact}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {mastery.length > 0 && (
            <MasteryCheck
              moments={mastery}
              finalExam={sectionIndex === course.sections.length - 1}
              onComplete={finishSection}
            />
          )}

          {sectionIndex === course.sections.length - 1 && complete.includes(sectionIndex) && (
            <section className="my-10 rounded-3xl border-2 border-[var(--accent)] bg-white p-8 sm:p-10">
              <Award size={36} className="text-[var(--accent)]" />
              <h2 className="mt-4 text-3xl font-semibold text-[var(--ink)]">
                {certificateUrl ? "Certificate earned" : "Final exam passed"}
              </h2>
              {recordingCompletion && <p className="mt-3 text-slate-600">Recording your completion...</p>}
              {completionError && <p className="mt-3 text-amber-800">{completionError}</p>}
              {certificateUrl && (
                <a
                  href={certificateUrl}
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--dark)] px-7 py-3 font-bold text-white"
                >
                  <Award size={18} /> View and print certificate
                </a>
              )}
            </section>
          )}

          {sectionIndex < course.sections.length - 1 && complete.includes(sectionIndex) && (
            <button
              type="button"
              onClick={() => changeSection(sectionIndex + 1)}
              className="inline-flex items-center gap-3 rounded-full bg-[var(--dark)] px-7 py-4 font-bold text-white"
            >
              Continue to {course.sections[sectionIndex + 1].title} <ArrowRight size={18} />
            </button>
          )}
          {sectionIndex > 0 && (
            <button
              type="button"
              onClick={() => changeSection(sectionIndex - 1)}
              className="ml-3 inline-flex items-center gap-2 px-4 py-4 font-semibold text-slate-600"
            >
              <ChevronLeft size={18} /> Previous section
            </button>
          )}
        </article>
      </div>
    </main>
  );
}

export default function GeneratedTrainingPage({
  course,
}: {
  course: PublicMasonCourse;
}) {
  if (course.displayMode === "slideshow") {
    return <SlideshowTrainingPage course={course} />;
  }

  return <WebpageTrainingPage course={course} />;
}
