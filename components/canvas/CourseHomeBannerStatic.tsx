import { getStudentDisplayName } from "@/lib/canvas/home-embed-messages";

type Props = {
  studentName?: string;
};

export function CourseHomeBannerStatic({ studentName = "Student" }: Props) {
  const displayName = getStudentDisplayName(studentName);

  return (
    <section className="course-home-banner course-home-banner-welcome">
      <p className="course-home-banner-welcome-line">{`Welcome, ${displayName}`}</p>
    </section>
  );
}
