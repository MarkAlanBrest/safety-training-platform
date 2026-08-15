import { HOME_EMBED_TEST_MESSAGE } from "@/lib/canvas/home-embed-constants";

type Props = {
  message?: string;
};

export function CourseHomeBannerStatic({ message = HOME_EMBED_TEST_MESSAGE }: Props) {
  return (
    <div className="course-home-embed-shell">
      <div className="course-home-banner-top-pixel" aria-hidden="true" />
      <div className="course-home-banner" role="alert">
        <strong>Reminder</strong>
        <p>{message}</p>
      </div>
    </div>
  );
}
