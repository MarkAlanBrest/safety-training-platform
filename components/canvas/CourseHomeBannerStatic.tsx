import { HOME_EMBED_TITLE } from "@/lib/canvas/home-embed-constants";
import { buildWelcomeMessage, getStudentDisplayName } from "@/lib/canvas/home-embed-messages";

type Props = {
  title?: string;
  studentName?: string;
  message?: string;
};

export function CourseHomeBannerStatic({
  title = HOME_EMBED_TITLE,
  studentName = "Student",
  message,
}: Props) {
  const displayName = getStudentDisplayName(studentName);
  const bannerMessage = message || buildWelcomeMessage(displayName);

  return (
    <section
      className="course-home-banner course-home-banner-welcome"
      aria-labelledby="course-home-alerts-title"
    >
      <h2 id="course-home-alerts-title" className="course-home-banner-title">
        {title}
      </h2>
      <p className="course-home-banner-message">{bannerMessage}</p>
    </section>
  );
}
