"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  KeyRound,
  LoaderCircle,
  Plus,
  Users,
} from "lucide-react";
import AdminShell from "@/components/AdminShell";

type Course = {
  id: number;
  title: string;
  slug: string;
  published: boolean;
  availableCodes: number;
  _count: {
    sections: number;
    enrollments: number;
  };
};

export default function AdminDashboardPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/courses", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : []))
      .then(setCourses)
      .finally(() => setLoading(false));
  }, []);

  const totals = useMemo(
    () => ({
      programs: courses.length,
      published: courses.filter((course) => course.published).length,
      codes: courses.reduce((total, course) => total + course.availableCodes, 0),
      learners: courses.reduce((total, course) => total + course._count.enrollments, 0),
    }),
    [courses],
  );

  return (
    <AdminShell
      title="Training operations"
      eyebrow="Overview"
      actions={
        <Link
          href="/admin/classroom/new"
          className="flex items-center gap-2 rounded-xl bg-[#10283f] px-4 py-3 text-sm font-bold text-white"
        >
          <Plus size={17} /> New program
        </Link>
      }
    >
      {loading ? (
        <div className="grid min-h-72 place-items-center">
          <LoaderCircle className="animate-spin text-[#a06e16]" size={30} />
        </div>
      ) : (
        <>
          <section className="grid min-w-0 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
            {[
              [BookOpen, totals.programs, "Training programs", `${totals.published} published`],
              [KeyRound, totals.codes, "Codes available", "Ready to sell or assign"],
              [Users, totals.learners, "Enrolled learners", "Across every program"],
              [BookOpen, courses.reduce((sum, item) => sum + item._count.sections, 0), "Course sections", "Generated from source material"],
            ].map(([Icon, value, label, note]) => {
              const MetricIcon = Icon as typeof BookOpen;
              return (
                <article key={String(label)} className="rounded-3xl border border-[#10283f]/10 bg-white p-6 shadow-sm">
                  <MetricIcon className="text-[#c1871b]" size={23} />
                  <p className="mt-5 font-serif text-4xl font-semibold text-[#10283f]">{String(value)}</p>
                  <p className="mt-1 font-bold text-[#263746]">{String(label)}</p>
                  <p className="mt-1 text-xs text-[#7a858c]">{String(note)}</p>
                </article>
              );
            })}
          </section>

          <section className="mt-8 rounded-3xl border border-[#10283f]/10 bg-white p-7">
            <div className="flex items-end justify-between gap-5">
              <div>
                <p className="text-xs font-black uppercase tracking-[.17em] text-[#9a6812]">Recent programs</p>
                <h2 className="mt-1 font-serif text-3xl font-semibold text-[#10283f]">Continue building</h2>
              </div>
              <Link href="/admin/courses" className="text-sm font-bold text-[#10283f]">View all</Link>
            </div>
            <div className="mt-6 divide-y divide-[#10283f]/10">
              {courses.slice(0, 5).map((course) => (
                <Link
                  key={course.id}
                  href={`/admin/courses/${course.slug}`}
                  className="flex items-center justify-between gap-5 py-4"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-[#10283f]">{course.title}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${course.published ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
                        {course.published ? "Published" : "Draft"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#7a858c]">
                      {course._count.sections} sections · {course._count.enrollments} learners · {course.availableCodes} codes ready
                    </p>
                  </div>
                  <ArrowRight size={18} className="text-[#9a6812]" />
                </Link>
              ))}
              {courses.length === 0 && (
                <div className="py-10 text-center">
                  <p className="text-[#6c7881]">No programs yet.</p>
                  <Link href="/admin/classroom/new" className="mt-4 inline-flex items-center gap-2 font-bold text-[#10283f]">
                    Create the first program <ArrowRight size={17} />
                  </Link>
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </AdminShell>
  );
}
