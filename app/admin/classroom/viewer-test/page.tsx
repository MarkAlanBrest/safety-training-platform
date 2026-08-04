import AdminShell from "@/components/AdminShell";
import AprysePptxTestViewer from "@/components/classroom/AprysePptxTestViewer";

export default function PptxViewerTestPage() {
  return (
    <AdminShell title="PowerPoint Viewer Test" eyebrow="AI Classroom">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 rounded-3xl border border-[#10283f]/10 bg-[#10283f] px-6 py-5 text-white">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[#e8c273]">
            Rendering comparison
          </p>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-white/80">
            Open one of your real training decks here and compare its appearance with PowerPoint.
            This page does not change the current classroom viewer.
          </p>
        </div>
        <AprysePptxTestViewer />
      </div>
    </AdminShell>
  );
}
