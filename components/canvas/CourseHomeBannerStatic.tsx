import { HOME_EMBED_TEST_MESSAGE, HOME_EMBED_TITLE } from "@/lib/canvas/home-embed-constants";

type Props = {
  title?: string;
  message?: string;
};

export function CourseHomeBannerStatic({
  title = HOME_EMBED_TITLE,
  message = HOME_EMBED_TEST_MESSAGE,
}: Props) {
  return (
    <div className="course-home-embed-shell">
      <div className="course-home-banner-top-pixel" aria-hidden="true" />
      <section className="course-home-banner" aria-labelledby="course-home-alerts-title">
        <h2 id="course-home-alerts-title" className="course-home-banner-title">
          {title}
        </h2>
        <p className="course-home-banner-message">{message}</p>
      </section>
    </div>
  );
}
