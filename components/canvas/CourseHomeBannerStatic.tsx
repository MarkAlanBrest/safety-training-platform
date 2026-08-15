import { getStudentDisplayName } from "@/lib/canvas/home-embed-messages";

type Props = {
  studentName?: string;
};

export function CourseHomeBannerStatic({ studentName = "Student" }: Props) {
  const displayName = getStudentDisplayName(studentName);

  return (
    <section className="course-home-banner course-home-banner-welcome">
      <p className="course-home-banner-message course-home-banner-welcome-text">
        Welcome, <span className="course-home-banner-name">{displayName}</span>
      </p>
    </section>
  );
}
