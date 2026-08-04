import AdminShell from "@/components/AdminShell";
import ContentSlideBuilderForm from "@/components/classroom/builder/ContentSlideBuilderForm";

export default function NewClassroomPage() {
  return (
    <AdminShell title="Course Builder" eyebrow="AI Classroom">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 rounded-3xl border border-[#10283f]/10 bg-[#10283f] px-6 py-5 text-white">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[#e8c273]">
            Content slide builder
          </p>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-white/80">
            Upload a PowerPoint and we&apos;ll render accurate slide pictures on the server and pull
            speaker notes for the AI instructor. Or export your own slide images as a ZIP and attach
            the PPT for notes.
          </p>
        </div>
        <ContentSlideBuilderForm />
      </div>
    </AdminShell>
  );
}
