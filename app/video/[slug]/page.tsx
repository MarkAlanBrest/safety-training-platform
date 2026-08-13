import { notFound } from "next/navigation";
import VideoCourseShell from "@/components/video/VideoCourseShell";
import { prisma } from "@/lib/prisma";
import { normalizeVideoPlan } from "@/lib/video";

export const dynamic = "force-dynamic";

export default async function VideoCoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const preview = Boolean(query.preview);

  const record = await prisma.masonCourse.findUnique({
    where: { slug },
    include: {
      sections: {
        orderBy: { position: "asc" },
        take: 1,
        select: { lessonPlan: true },
      },
    },
  });

  if (!record || record.courseType !== "video") notFound();
  const plan = normalizeVideoPlan(record.sections[0]?.lessonPlan, record.title);
  if (!plan) notFound();

  return (
    <VideoCourseShell
      preview={preview}
      course={{
        title: record.title,
        slug: record.slug,
        description: record.description,
        plan,
      }}
    />
  );
}
