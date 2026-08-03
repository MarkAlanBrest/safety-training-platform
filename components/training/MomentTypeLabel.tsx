import type { LessonMoment } from "@/lib/mason";

const labels: Record<LessonMoment["kind"], string> = {
  explain: "Explain",
  text: "Text page",
  tiles: "Tiles",
  dragdrop: "Drag to order",
  visual: "Visual",
  question: "Question",
  scenario: "Scenario",
  summary: "Summary",
};

export default function MomentTypeLabel({ kind }: { kind: LessonMoment["kind"] }) {
  return (
    <p className="mb-3 text-[11px] font-black uppercase tracking-[.28em] text-slate-400">
      {labels[kind]} moment
    </p>
  );
}

export function isExampleShowcaseCourse(slug: string) {
  return slug === "demo" || slug === "workplace-sexual-harassment-prevention";
}
