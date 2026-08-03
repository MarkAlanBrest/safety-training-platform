import AdminShell from "@/components/AdminShell";
import CourseBuilderForm from "@/components/classroom/builder/CourseBuilderForm";

export default function NewClassroomPage() {
  return (
    <AdminShell title="Course Builder" eyebrow="AI Classroom">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 rounded-3xl border border-[#10283f]/10 bg-[#10283f] px-6 py-5 text-white">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[#e8c273]">
            Course Builder
          </p>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-white/80">
            Upload your knowledge package, configure how the AI teaches, choose activities and
            presentation tools, then publish a live classroom experience.
          </p>
        </div>
        <CourseBuilderForm />
      </div>
    </AdminShell>
  );
}
