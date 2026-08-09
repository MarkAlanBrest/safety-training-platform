import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { learnerCoursePath } from "@/lib/course-routes";

export const dynamic = "force-dynamic";

export default async function LegacyTrainingRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const record = await prisma.masonCourse.findUnique({
    where: { slug },
    select: { slug: true, courseType: true },
  });
  redirect(learnerCoursePath(record?.slug || slug, record?.courseType));
}
