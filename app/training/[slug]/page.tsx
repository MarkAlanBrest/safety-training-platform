import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { learnerCoursePath } from "@/lib/course-routes";

export const dynamic = "force-dynamic";

export default async function LegacyTrainingRedirectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  if (slug === "demo") {
    redirect("/classroom/demo");
  }

  const record = await prisma.masonCourse.findUnique({
    where: { slug },
    select: { slug: true, courseType: true },
  });

  if (!record) notFound();

  if (record.courseType === "classroom") {
    redirect(learnerCoursePath(record.slug, record.courseType));
  }

  notFound();
}
