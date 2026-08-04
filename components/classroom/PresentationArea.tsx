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
import { structureClassroomSlide } from "@/lib/classroom-slide-content";
import { slideImageSrc } from "@/lib/classroom";
import SlideCanvas from "@/components/classroom/SlideCanvas";
import SlideImageStage from "@/components/classroom/SlideImageStage";

export default function PresentationArea({
  plan,
  view,
  activeSlideIndex,
  onGoToSlide,
  onSelectChoice,
}: {
  plan: ClassroomPlan;
  view: PresentationView;
  activeSlideIndex: number;
  onGoToSlide?: (slideIndex: number) => void;
  onSelectChoice?: (choice: string) => void;
}) {
  const safeView: PresentationView =
    view?.type === "welcome"
      ? view
      : view?.type === "slide"
        ? view
        : view?.type === "question" ||
            view?.type === "exercise" ||
            view?.type === "example" ||
            view?.type === "assessment"
          ? view
          : {
              type: "welcome",
              headline: plan.title,
              body: plan.opening,
            };

  const displaySlideIndex =
    safeView.type === "slide" ? safeView.slideIndex : activeSlideIndex;
  const slide = plan.slides[displaySlideIndex] || plan.slides[0];
  const structuredSlide = slide ? structureClassroomSlide(slide) : null;
  const activeImageIndex =
    safeView.type === "slide" && typeof safeView.imageIndex === "number"
      ? safeView.imageIndex
      : undefined;
  const slideImage = structuredSlide ? slideImageSrc(structuredSlide, activeImageIndex) : "";
  const hasSlideImage = Boolean(slideImage);
  const isCheckpoint =
    safeView.type === "question" ||
    safeView.type === "exercise" ||
    safeView.type === "assessment";

  const headline =
    safeView.type === "welcome"
      ? safeView.headline
      : safeView.type === "question" ||
          safeView.type === "exercise" ||
          safeView.type === "example" ||
          safeView.type === "assessment"
        ? safeView.headline
        : safeView.headline || slide?.title || plan.title;

  const eyebrow =
    safeView.type === "question"
      ? "Your instructor is asking"
      : safeView.type === "exercise"
        ? "Try this"
        : safeView.type === "assessment"
          ? "Final assessment"
          : safeView.type === "example"
            ? "Example"
            : safeView.type === "welcome"
              ? "Welcome"
              : "On screen";

  const Icon =
    safeView.type === "question"
      ? MessageCircleQuestion
      : safeView.type === "exercise"
        ? Lightbulb
        : safeView.type === "assessment"
          ? ClipboardCheck
          : Presentation;

  const canGoBack = displaySlideIndex > 0;
  const canGoForward = displaySlideIndex < plan.slides.length - 1;

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden bg-[#eef2f7]">
      <div className="shrink-0 flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[.16em] text-slate-500">
            Presentation
          </p>
          <h1 className="truncate text-xl font-bold text-slate-900">{headline}</h1>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {safeView.type !== "welcome" && plan.slides.length > 1 ? (
            <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                disabled={!canGoBack}
                onClick={() => onGoToSlide?.(displaySlideIndex - 1)}
                className="grid h-8 w-8 place-items-center rounded-full text-slate-600 transition hover:bg-white disabled:opacity-30"
                aria-label="Previous slide"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="px-2 text-xs font-semibold text-slate-600">
                {displaySlideIndex + 1} / {plan.slides.length}
              </span>
              <button
                type="button"
                disabled={!canGoForward}
                onClick={() => onGoToSlide?.(displaySlideIndex + 1)}
                className="grid h-8 w-8 place-items-center rounded-full text-slate-600 transition hover:bg-white disabled:opacity-30"
                aria-label="Next slide"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          ) : null}

          <div className="hidden items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 sm:flex">
            <Icon size={14} />
            {eyebrow}
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden p-5 lg:p-6">
        <div className="relative flex min-h-0 flex-1 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,.08)]">
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
          ) : hasSlideImage && structuredSlide ? (
            <>
              <SlideImageStage
                imageUrl={slideImage}
                title={structuredSlide.title}
                focus={safeView.type === "slide" ? safeView.focus : undefined}
                hotspots={structuredSlide.hotspots}
              />
              {isCheckpoint ? (
                <div className="absolute inset-x-4 bottom-4 max-h-[38%] overflow-y-auto rounded-2xl border border-white/10 bg-[#07111f]/92 px-5 py-4 shadow-xl backdrop-blur sm:inset-x-6">
                  <p className="text-xs font-bold uppercase tracking-[.16em] text-amber-300">
                    {safeView.type === "assessment"
                      ? "Final assessment"
                      : "Interactive checkpoint"}
                  </p>
                  <p className="mt-2 text-lg font-semibold leading-8 text-white">
                    {safeView.prompt}
                  </p>
                  {safeView.type === "assessment" &&
                  safeView.questionCount &&
                  typeof safeView.questionIndex === "number" ? (
                    <p className="mt-1 text-sm text-slate-400">
                      Question {safeView.questionIndex + 1} of {safeView.questionCount}
                    </p>
                  ) : null}
                  {safeView.choices?.length ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {safeView.choices.map((choice) => (
                        <button
                          key={choice}
                          type="button"
                          onClick={() => onSelectChoice?.(choice)}
                          className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-400 hover:text-slate-950"
                        >
                          {choice}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : safeView.type === "slide" && structuredSlide ? (
            <SlideCanvas slide={structuredSlide} courseTitle={plan.title} />
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
