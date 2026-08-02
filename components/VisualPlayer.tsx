import PicturesOnlyPlayer from "@/components/PicturesOnlyPlayer";
import { buildPlayerFrames, type LessonMoment } from "@/lib/mason";

/** Admin preview wrapper around the learner pictures-only player. */
export default function VisualPlayer({
  moment,
  courseSlug,
}: {
  moment: LessonMoment;
  courseSlug?: string;
}) {
  return (
    <PicturesOnlyPlayer frames={buildPlayerFrames(moment)} courseSlug={courseSlug} />
  );
}
