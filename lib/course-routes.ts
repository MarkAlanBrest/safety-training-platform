export function learnerCoursePath(
  slug: string,
  courseType?: string | null,
) {
  if (courseType === "classroom") {
    return `/classroom/${slug}`;
  }
  return `/training/${slug}`;
}
