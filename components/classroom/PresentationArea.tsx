"use client";

import type { ClassroomPlan, PresentationView } from "@/lib/classroom";
import { slideDeckContext } from "@/lib/classroom";
import { Coffee, Headphones, MessageSquareText, MousePointerClick } from "lucide-react";
import ClassroomDragOrder from "@/components/classroom/ClassroomDragOrder";
import ClassroomFlashcards from "@/components/classroom/ClassroomFlashcards";
import ClassroomHotspotQuestion from "@/components/classroom/ClassroomHotspotQuestion";
import PptxSlideViewer from "@/components/classroom/PptxSlideViewer";
import SlideImageStage from "@/components/classroom/SlideImageStage";
import SlideStageTransition from "@/components/classroom/SlideStageTransition";

export default function PresentationArea({
  plan,
  view,
  activeSlideIndex,
  onToggleBreak,
  paused = false,
  onActivityComplete,
  captionText = "",
}: {
  plan: ClassroomPlan;
  view: PresentationView;
  activeSlideIndex: number;
  onToggleBreak: () => void;
  paused?: boolean;
  onActivityComplete?: () => void;
  captionText?: string;
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
            view?.type === "dragdrop" ||
            view?.type === "hotspot"
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

  const stageKey =
    safeView.type === "slide"
      ? `slide-${displaySlideIndex}`
      : `${safeView.type}-${safeView.type === "assessment" ? safeView.questionIndex ?? 0 : ""}`;

  const stageTransition =
    safeView.type === "slide" ? slide?.transition || "fade" : "fade";

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden bg-[#eef2f7]">
      <div className="flex min-h-0 flex-1 overflow-hidden p-2 lg:p-3">
        <div className="relative flex min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,.08)]">
          {paused ? (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/65 backdrop-blur-sm">
              <div className="rounded-3xl bg-white px-10 py-8 text-center shadow-2xl">
                <Coffee className="mx-auto text-amber-600" size={30} />
                <p className="mt-3 text-2xl font-bold text-slate-900">Class paused</p>
                <button
                  type="button"
                  onClick={onToggleBreak}
                  className="mt-5 rounded-xl bg-[#0f2b46] px-5 py-2.5 text-sm font-bold text-white"
                >
                  Resume class
                </button>
              </div>
            </div>
          ) : null}
          <SlideStageTransition stageKey={stageKey} transition={stageTransition}>
            {safeView.type === "welcome" ? (
            <div className="h-full w-full overflow-y-auto bg-gradient-to-br from-[#0f2b46] to-[#163a5d] px-6 py-8 text-white sm:px-10 lg:px-12">
              <div className="mx-auto flex min-h-full max-w-5xl flex-col justify-center">
              <p className="text-xs font-bold uppercase tracking-[.2em] text-amber-200">
                Welcome to your course
              </p>
              <h2 className="mt-3 max-w-4xl text-3xl font-bold leading-tight lg:text-4xl">
                {safeView.headline}
              </h2>
              <p className="mt-3 max-w-3xl text-base leading-7 text-slate-200 lg:text-lg">{safeView.body}</p>
              <p className="mt-6 max-w-xl text-sm text-slate-300">
                Your instructor will guide this session — respond in the chat when prompted.
              </p>
              <div className="mt-7">
                <p className="text-sm font-bold uppercase tracking-[.16em] text-white">
                  How to take this course
                </p>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
                    <Headphones className="text-amber-300" size={23} aria-hidden="true" />
                    <p className="mt-3 font-bold">1. Watch and listen</p>
                    <p className="mt-1 text-sm leading-6 text-slate-300">
                      Your AI instructor will explain each slide and move through the lesson with you.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
                    <MessageSquareText className="text-amber-300" size={23} aria-hidden="true" />
                    <p className="mt-3 font-bold">2. Join the conversation</p>
                    <p className="mt-1 text-sm leading-6 text-slate-300">
                      Type or speak in the instructor panel whenever you have a question or are asked to respond.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
                    <MousePointerClick className="text-amber-300" size={23} aria-hidden="true" />
                    <p className="mt-3 font-bold">3. Complete each activity</p>
                    <p className="mt-1 text-sm leading-6 text-slate-300">
                      Answer knowledge checks and finish the final test. Use the top menu to review earlier topics.
                    </p>
                  </div>
                </div>
              </div>
              <p className="mt-5 rounded-xl border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-sm font-semibold text-amber-100">
                The lesson advances automatically. Select Pause at the top any time you need a break.
              </p>
              </div>
            </div>
          ) : safeView.type === "slide" && slideImage ? (
            <SlideImageStage
              imageUrl={slideImage}
              title={slide?.title || plan.title}
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
                  {displaySlideIndex + 1}. {slide?.title}
                </p>
                <p className="mt-3 text-sm text-slate-500">
                  This visual is missing. Re-upload the source file to restore it.
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
          ) : safeView.type === "hotspot" ? (
            <ClassroomHotspotQuestion
              headline={safeView.headline}
              prompt={safeView.prompt}
              imageUrl={safeView.imageUrl}
              targetX={safeView.targetX}
              targetY={safeView.targetY}
              toleranceRadius={safeView.toleranceRadius}
              onComplete={onActivityComplete}
            />
          ) : isCheckpoint ? (
            <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-amber-50 via-white to-slate-50 px-8 py-10">
              <div className="max-w-2xl text-center">
                <p className="text-sm font-bold uppercase tracking-[.16em] text-amber-600">
                  {safeView.type === "assessment" ? "Final assessment" : "Check your understanding"}
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
                <p className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-900">
                  Type or speak your answer in the instructor panel on the right.
                </p>
              </div>
            </div>
          ) : safeView.type === "example" ? (
            <div className="flex h-full w-full items-center justify-center px-10">
              <p className="max-w-3xl text-center text-lg leading-8 text-slate-700">
                {safeView.body}
              </p>
            </div>
          ) : null}
          </SlideStageTransition>
          {captionText ? (
            <div
              className="pointer-events-none absolute inset-x-4 bottom-4 z-30 flex justify-center"
              aria-live="polite"
              aria-atomic="true"
            >
              <p className="max-w-4xl rounded-xl bg-slate-950/90 px-5 py-3 text-center text-base font-semibold leading-7 text-white shadow-2xl backdrop-blur-sm lg:text-lg">
                {captionText}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
