export function learnerCoursePath(
  slug: string,
  courseType?: string | null,
) {
  if (courseType && courseType !== "classroom") {
    return `/training/${slug}`;
  }
  return `/classroom/${slug}`;
}
