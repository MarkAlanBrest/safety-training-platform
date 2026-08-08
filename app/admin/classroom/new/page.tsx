import AdminShell from "@/components/AdminShell";
import VideoCourseBuilderForm from "@/components/classroom/builder/VideoCourseBuilderForm";

export default function NewClassroomPage() {
  return (
    <AdminShell title="Course Builder" eyebrow="AI Classroom">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 rounded-3xl border border-[#10283f]/10 bg-[#10283f] px-6 py-5 text-white">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[#e8c273]">
            Video course builder
          </p>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-white/80">
            Upload one full-screen video. The platform reads the audio and builds a timed
            transcript for the instructor chat automatically. Add AI stop points on the timeline
            when you want questions or extra instructor moments.
          </p>
        </div>
        <VideoCourseBuilderForm />
      </div>
    </AdminShell>
  );
}
