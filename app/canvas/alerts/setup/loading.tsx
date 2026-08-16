import "../../course-alerts.css";

export default function CourseAlertsSetupLoading() {
  return (
    <main className="course-alerts-page course-alerts-page-setup">
      <div className="course-alerts-setup-loading" role="status" aria-live="polite">
        <span className="course-alerts-setup-spinner" aria-hidden="true" />
        <div>
          <strong>Loading course settings</strong>
          <p>Please wait while Canvas connects to this course.</p>
        </div>
      </div>
    </main>
  );
}
