import AdminShell from "@/components/AdminShell";
import PowerPointCourseBuilderForm from "@/components/classroom/builder/PowerPointCourseBuilderForm";

export default function NewClassroomPage() {
  return (
    <AdminShell title="Course Builder" eyebrow="AI Classroom">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 rounded-3xl border border-[#10283f]/10 bg-[#10283f] px-6 py-5 text-white">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[#e8c273]">
            PowerPoint course builder
          </p>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-white/80">
            Upload one or more PowerPoints as ordered chapters. The decks supply the course visuals,
            and their speaker notes direct the AI instructor on each slide.
          </p>
        </div>
        <PowerPointCourseBuilderForm />
      </div>
    </AdminShell>
  );
}
