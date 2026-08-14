import { GraduationCap } from "lucide-react";

export function CanvasLaunchHint() {
  return (
    <div className="canvas-connect-card">
      <div className="canvas-connect-icon">
        <GraduationCap size={34} />
      </div>
      <h1>Open this from Canvas</h1>
      <p>
        This page shows your missing assignments and grades after you launch it from your Canvas course.
        If you are a student, ask your instructor or admin where the tool is linked.
      </p>
    </div>
  );
}
