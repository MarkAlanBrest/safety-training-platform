export function learnerCoursePath(
  slug: string,
  courseType?: string | null,
) {
  if (courseType === "classroom") {
    return `/classroom/${slug}`;
  }
  if (courseType === "video") {
    return `/video/${slug}`;
  }
  return `/training/${slug}`;
}
