"use client";

import ListenButton from "@/components/training/ListenButton";

function paragraphs(text: string) {
  return text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export default function ReadingSlide({
  title,
  narration,
  variant = "learn",
  compact = false,
  eyebrow,
}: {
  title: string;
  narration: string;
  variant?: "learn" | "summary";
  compact?: boolean;
  eyebrow?: string;
}) {
  const parts = paragraphs(narration);
  const resolvedEyebrow =
    eyebrow ?? (variant === "summary" ? "Key takeaway" : "Learn");

  if (variant === "summary") {
    return (
      <section
        className={`${compact ? "my-0" : "my-14"} overflow-hidden rounded-2xl border border-[var(--accent)]/20 bg-gradient-to-br from-[var(--pale)] to-white shadow-[0_20px_60px_rgba(15,23,42,.08)]`}
      >
        <div className="h-1.5 bg-gradient-to-r from-[var(--accent)] to-[var(--dark)]" />
        <div className={`${compact ? "px-6 py-8 sm:px-10" : "px-7 py-9 sm:px-12 sm:py-11"}`}>
          <p className="text-xs font-black uppercase tracking-[.22em] text-[var(--accent)]">
            {resolvedEyebrow}
          </p>
          <h2
            className={`mt-3 font-bold tracking-tight text-[var(--ink)] ${
              compact ? "text-3xl sm:text-4xl" : "text-3xl sm:text-4xl"
            }`}
          >
            {title}
          </h2>
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <ListenButton text={[title, ...parts].join("\n\n")} />
          </div>
          <div className="mt-7 max-w-3xl space-y-5">
            {parts.map((paragraph) => (
              <p key={paragraph} className="text-lg leading-8 text-slate-700">
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={compact ? "my-0" : "my-14"}>
      <div
        className={`overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_20px_60px_rgba(15,23,42,.07)] ${
          compact ? "" : ""
        }`}
      >
        <div className="h-1 bg-gradient-to-r from-[var(--accent)] via-[var(--accent)]/60 to-transparent" />
        <div className={`${compact ? "px-6 py-8 sm:px-10" : "px-7 py-9 sm:px-10 sm:py-11"}`}>
          <p className="text-xs font-black uppercase tracking-[.22em] text-[var(--accent)]">
            {resolvedEyebrow}
          </p>
          <h2
            className={`mt-3 font-bold tracking-tight text-[var(--ink)] ${
              compact ? "text-3xl sm:text-5xl" : "text-3xl sm:text-4xl"
            }`}
          >
            {title}
          </h2>
          <div className="mt-5">
            <ListenButton text={[title, ...parts].join("\n\n")} />
          </div>
          <div className="mt-8 max-w-3xl space-y-6">
            {parts.map((paragraph, index) => (
              <p
                key={paragraph}
                className={`leading-8 text-slate-600 ${
                  index === 0
                    ? "text-xl font-medium text-slate-700"
                    : "text-lg"
                }`}
              >
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
