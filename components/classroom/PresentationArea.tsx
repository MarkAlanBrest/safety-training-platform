"use client";

import { ClipboardCheck, Lightbulb, MessageCircleQuestion, Presentation } from "lucide-react";
import type { ClassroomPlan, PresentationView } from "@/lib/classroom";
import { structureClassroomSlide } from "@/lib/classroom-slide-content";
import SlideCanvas from "@/components/classroom/SlideCanvas";

export default function PresentationArea({
  plan,
  view,
  onSelectChoice,
}: {
  plan: ClassroomPlan;
  view: PresentationView;
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

  const slide =
    safeView.type === "slide"
      ? plan.slides[safeView.slideIndex] || plan.slides[0]
      : plan.slides[0];
  const structuredSlide = slide ? structureClassroomSlide(slide) : null;

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

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden bg-[#eef2f7]">
      <div className="shrink-0 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.16em] text-slate-500">
            Presentation
          </p>
          <h1 className="text-xl font-bold text-slate-900">{headline}</h1>
        </div>
        <div className="hidden items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 sm:flex">
          <Icon size={14} />
          {eyebrow}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-5 lg:p-6">
        <div className="flex min-h-0 flex-1 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,.08)]">
          {safeView.type === "welcome" ? (
            <div className="flex h-full w-full flex-col justify-center bg-gradient-to-br from-[#0f2b46] to-[#163a5d] p-10 text-white">
              <p className="text-xs font-bold uppercase tracking-[.2em] text-amber-200">
                Welcome
              </p>
              <h2 className="mt-4 max-w-3xl text-4xl font-bold leading-tight">{safeView.headline}</h2>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-200">{safeView.body}</p>
            </div>
          ) : safeView.type === "slide" && structuredSlide ? (
            <SlideCanvas slide={structuredSlide} courseTitle={plan.title} />
          ) : safeView.type === "question" ||
            safeView.type === "exercise" ||
            safeView.type === "assessment" ? (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-amber-50 via-white to-slate-50 px-8">
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
              </div>
            </div>
          ) : null}
        </div>

        <div className="shrink-0 overflow-hidden rounded-3xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
          {safeView.type === "welcome" && (
            <p className="line-clamp-3 text-base leading-7 text-slate-700">{safeView.body}</p>
          )}

          {safeView.type === "slide" && slide?.speakerNotes ? (
            <p className="text-sm leading-6 text-slate-500">
              <span className="font-semibold text-slate-700">Instructor note:</span>{" "}
              {slide.speakerNotes}
            </p>
          ) : null}

          {(safeView.type === "question" ||
            safeView.type === "exercise" ||
            safeView.type === "assessment") && (
            <>
              <p className="line-clamp-3 text-base font-semibold leading-7 text-slate-900">
                {safeView.prompt}
              </p>
              {safeView.choices?.length ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {safeView.choices.map((choice) => (
                    <button
                      key={choice}
                      type="button"
                      onClick={() => onSelectChoice?.(choice)}
                      className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-amber-300 hover:bg-amber-50"
                    >
                      {choice}
                    </button>
                  ))}
                </div>
              ) : null}
            </>
          )}

          {safeView.type === "example" && (
            <p className="line-clamp-4 text-base leading-7 text-slate-700">{safeView.body}</p>
          )}
        </div>
      </div>
    </section>
  );
}
