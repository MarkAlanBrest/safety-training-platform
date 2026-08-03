"use client";

import { Lightbulb, MessageCircleQuestion, Presentation } from "lucide-react";
import type { ClassroomPlan, PresentationView } from "@/lib/classroom";

export default function PresentationArea({
  plan,
  view,
}: {
  plan: ClassroomPlan;
  view: PresentationView;
}) {
  const safeView: PresentationView =
    view?.type === "welcome"
      ? view
      : view?.type === "slide"
        ? view
        : view?.type === "question" || view?.type === "exercise" || view?.type === "example"
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

  const headline =
    safeView.type === "welcome"
      ? safeView.headline
      : safeView.type === "question" ||
          safeView.type === "exercise" ||
          safeView.type === "example"
        ? safeView.headline
        : safeView.headline || slide?.title || plan.title;

  const imageUrl =
    safeView.type === "example" && safeView.imageDataUrl
      ? safeView.imageDataUrl
      : safeView.type === "slide"
        ? slide?.imageDataUrl
        : slide?.imageDataUrl;

  const eyebrow =
    safeView.type === "question"
      ? "Your instructor is asking"
      : safeView.type === "exercise"
        ? "Try this"
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
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,.08)]">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={headline}
              className="max-h-full max-w-full object-contain bg-slate-50"
            />
          ) : null}
        </div>

        <div className="shrink-0 overflow-hidden rounded-3xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
          {safeView.type === "welcome" && (
            <p className="line-clamp-4 text-base leading-7 text-slate-700">{safeView.body}</p>
          )}

          {safeView.type === "slide" && slide && (
            <>
              <p className="line-clamp-4 text-base leading-7 text-slate-700">{slide.bodyText}</p>
              {slide.speakerNotes ? (
                <p className="mt-3 line-clamp-2 border-t border-slate-100 pt-3 text-sm leading-6 text-slate-500">
                  Instructor note: {slide.speakerNotes}
                </p>
              ) : null}
            </>
          )}

          {(safeView.type === "question" || safeView.type === "exercise") && (
            <>
              <p className="line-clamp-3 text-base font-semibold leading-7 text-slate-900">
                {safeView.prompt}
              </p>
              {safeView.choices?.length ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {safeView.choices.map((choice) => (
                    <span
                      key={choice}
                      className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700"
                    >
                      {choice}
                    </span>
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
