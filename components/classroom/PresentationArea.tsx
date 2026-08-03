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
  const slide =
    view.type === "slide"
      ? plan.slides[view.slideIndex]
      : plan.slides[0];

  const headline =
    view.type === "welcome"
      ? view.headline
      : view.type === "question" || view.type === "exercise" || view.type === "example"
        ? view.headline
        : view.headline || slide?.title || plan.title;

  const imageUrl =
    view.type === "example" && view.imageDataUrl
      ? view.imageDataUrl
      : view.type === "slide"
        ? slide?.imageDataUrl
        : slide?.imageDataUrl;

  const eyebrow =
    view.type === "question"
      ? "Your instructor is asking"
      : view.type === "exercise"
        ? "Try this"
        : view.type === "example"
          ? "Example"
          : view.type === "welcome"
            ? "Welcome"
            : "On screen";

  const Icon =
    view.type === "question"
      ? MessageCircleQuestion
      : view.type === "exercise"
        ? Lightbulb
        : Presentation;

  return (
    <section className="flex h-full min-w-0 flex-col bg-[#eef2f7]">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
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

      <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-5 lg:p-8">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,.08)]">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={headline}
              className="max-h-[52vh] w-full object-contain bg-slate-50"
            />
          ) : null}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          {view.type === "welcome" && (
            <p className="text-lg leading-8 text-slate-700">{view.body}</p>
          )}

          {view.type === "slide" && slide && (
            <>
              <p className="text-lg leading-8 text-slate-700">{slide.bodyText}</p>
              {slide.speakerNotes ? (
                <p className="mt-4 border-t border-slate-100 pt-4 text-sm leading-7 text-slate-500">
                  Instructor note: {slide.speakerNotes}
                </p>
              ) : null}
            </>
          )}

          {(view.type === "question" || view.type === "exercise") && (
            <>
              <p className="text-lg font-semibold leading-8 text-slate-900">
                {view.prompt}
              </p>
              {view.choices?.length ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {view.choices.map((choice) => (
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

          {view.type === "example" && (
            <p className="text-lg leading-8 text-slate-700">{view.body}</p>
          )}
        </div>
      </div>
    </section>
  );
}
