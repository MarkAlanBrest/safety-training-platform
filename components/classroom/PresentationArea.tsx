"use client";

import {
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Lightbulb,
  MessageCircleQuestion,
  Presentation,
} from "lucide-react";
import type { ClassroomPlan, PresentationView } from "@/lib/classroom";
import { slideDeckContext } from "@/lib/classroom";
import ClassroomDragOrder from "@/components/classroom/ClassroomDragOrder";
import ClassroomFlashcards from "@/components/classroom/ClassroomFlashcards";
import PptxSlideViewer from "@/components/classroom/PptxSlideViewer";
import SlideImageStage from "@/components/classroom/SlideImageStage";
import LessonFlowSelect from "@/components/classroom/LessonFlowSelect";
import { buildLessonBeats, type ClassroomLessonBeat } from "@/lib/classroom-lesson";

export default function PresentationArea({
  plan,
  view,
  activeSlideIndex,
  lessonBeats,
  activeBeatIndex,
  onSelectBeat,
  onSelectChoice,
  onActivityComplete,
}: {
  plan: ClassroomPlan;
  view: PresentationView;
  activeSlideIndex: number;
  lessonBeats?: ClassroomLessonBeat[];
  activeBeatIndex: number;
  onSelectBeat: (beatIndex: number) => void;
  onSelectChoice?: (choice: string) => void;
  onActivityComplete?: () => void;
}) {
  const safeView: PresentationView =
    view?.type === "welcome"
      ? view
      : view?.type === "slide"
        ? view
        : view?.type === "question" ||
            view?.type === "exercise" ||
            view?.type === "example" ||
            view?.type === "assessment" ||
            view?.type === "flashcard" ||
            view?.type === "dragdrop"
          ? view
          : {
              type: "welcome",
              headline: plan.title,
              body: plan.opening,
            };

  const displaySlideIndex =
    safeView.type === "slide" ? safeView.slideIndex : activeSlideIndex;
  const slide = plan.slides[displaySlideIndex] || plan.slides[0];
  const slideImage = slide?.imageUrl || slide?.imageDataUrl || "";
  const deckContext = slideDeckContext(plan, displaySlideIndex);
  const isCheckpoint =
    safeView.type === "question" ||
    safeView.type === "exercise" ||
    safeView.type === "assessment";

  const headline =
    safeView.type === "welcome"
      ? safeView.headline
      : safeView.type === "question" ||
          safeView.type === "exercise" ||
          safeView.type === "assessment" ||
          safeView.type === "flashcard" ||
          safeView.type === "dragdrop"
        ? safeView.headline
        : safeView.type === "slide"
          ? safeView.headline || slide?.title || plan.title
          : slide?.title || plan.title;

  const eyebrow =
    safeView.type === "question"
      ? "Your instructor is asking"
      : safeView.type === "exercise"
        ? "Try this"
        : safeView.type === "assessment"
          ? "Final assessment"
          : safeView.type === "flashcard"
            ? "Flash cards"
            : safeView.type === "dragdrop"
              ? "Drag and drop"
              : safeView.type === "example"
                ? "Example"
                : safeView.type === "welcome"
                  ? "Welcome"
                  : null;

  const Icon =
    safeView.type === "question"
      ? MessageCircleQuestion
      : safeView.type === "exercise"
        ? Lightbulb
        : safeView.type === "assessment"
          ? ClipboardCheck
          : Presentation;

  const navigationBeats = lessonBeats || plan.lessonBeats || buildLessonBeats(plan);
  const canGoToPreviousItem = activeBeatIndex > 0;
  const canGoToNextItem = activeBeatIndex < navigationBeats.length - 1;

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden bg-[#eef2f7]">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6 sm:py-4">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[.16em] text-slate-500">
            Presentation
          </p>
          <h1 className="truncate text-xl font-bold text-slate-900">{headline}</h1>
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
          <LessonFlowSelect
            plan={plan}
            lessonBeats={lessonBeats}
            activeBeatIndex={activeBeatIndex}
            onSelectBeat={onSelectBeat}
          />
          <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              disabled={!canGoToPreviousItem}
              onClick={() => onSelectBeat(activeBeatIndex - 1)}
              className="grid h-8 w-8 place-items-center rounded-full text-slate-600 transition hover:bg-white disabled:opacity-30"
              aria-label="Previous lesson item"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="px-2 text-xs font-semibold text-slate-600">
              {safeView.type === "slide"
                ? `${displaySlideIndex + 1} / ${plan.slides.length}`
                : `${activeBeatIndex + 1} / ${navigationBeats.length}`}
            </span>
            <button
              type="button"
              disabled={!canGoToNextItem}
              onClick={() => onSelectBeat(activeBeatIndex + 1)}
              className="grid h-8 w-8 place-items-center rounded-full text-slate-600 transition hover:bg-white disabled:opacity-30"
              aria-label="Next lesson item"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {eyebrow ? (
            <div className="hidden items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 sm:flex">
              <Icon size={14} />
              {eyebrow}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden p-2 lg:p-3">
        <div className="relative flex min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,.08)]">
          {safeView.type === "welcome" ? (
            <div className="flex h-full w-full flex-col justify-center bg-gradient-to-br from-[#0f2b46] to-[#163a5d] p-10 text-white">
              <p className="text-xs font-bold uppercase tracking-[.2em] text-amber-200">
                Welcome
              </p>
              <h2 className="mt-4 max-w-3xl text-4xl font-bold leading-tight">
                {safeView.headline}
              </h2>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-200">{safeView.body}</p>
            </div>
          ) : safeView.type === "slide" && slideImage ? (
            <SlideImageStage
              imageUrl={slideImage}
              title={slide?.title || plan.title}
              focus={safeView.focus}
              hotspots={slide?.hotspots}
            />
          ) : safeView.type === "slide" && deckContext ? (
            <PptxSlideViewer
              deckUrl={deckContext.deckUrl}
              slideIndex={deckContext.localSlideIndex}
              title={slide?.title || plan.title}
            />
          ) : safeView.type === "slide" ? (
            <div className="flex h-full w-full items-center justify-center px-10 text-center">
              <div>
                <p className="text-lg font-semibold text-slate-800">
                  Slide {displaySlideIndex + 1}: {slide?.title}
                </p>
                <p className="mt-3 text-sm text-slate-500">
                  This slide image is missing. Re-upload the PowerPoint to restore the original
                  slides.
                </p>
              </div>
            </div>
          ) : safeView.type === "flashcard" ? (
            <ClassroomFlashcards
              headline={safeView.headline}
              prompt={safeView.prompt}
              flashcards={safeView.flashcards}
              onComplete={onActivityComplete}
            />
          ) : safeView.type === "dragdrop" ? (
            <ClassroomDragOrder
              headline={safeView.headline}
              prompt={safeView.prompt}
              dragItems={safeView.dragItems}
              onComplete={onActivityComplete}
            />
          ) : isCheckpoint ? (
            <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-amber-50 via-white to-slate-50 px-8 py-10">
              <div className="max-w-2xl text-center">
                <p className="text-sm font-bold uppercase tracking-[.16em] text-amber-600">
                  {safeView.type === "assessment" ? "Final assessment" : "Interactive checkpoint"}
                </p>
                <p className="mt-4 text-3xl font-semibold leading-10 text-slate-900">
                  {safeView.prompt}
                </p>
                {safeView.type === "assessment" &&
                safeView.questionCount &&
                typeof safeView.questionIndex === "number" ? (
                  <p className="mt-3 text-sm text-slate-500">
                    Question {safeView.questionIndex + 1} of {safeView.questionCount}
                  </p>
                ) : null}
                {safeView.choices?.length ? (
                  <div className="mt-8 flex flex-wrap justify-center gap-2">
                    {safeView.choices.map((choice) => (
                      <button
                        key={choice}
                        type="button"
                        onClick={() => onSelectChoice?.(choice)}
                        className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-amber-300 hover:bg-amber-50"
                      >
                        {choice}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ) : safeView.type === "example" ? (
            <div className="flex h-full w-full items-center justify-center px-10">
              <p className="max-w-3xl text-center text-lg leading-8 text-slate-700">
                {safeView.body}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
