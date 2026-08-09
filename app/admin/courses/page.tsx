"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Clock3,
  KeyRound,
  LoaderCircle,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import AdminShell from "@/components/AdminShell";
import { parseJsonResponse } from "@/lib/parse-response";

type Course = {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  theme: string;
  intensity: string;
  estimatedMinutes: number;
  published: boolean;
  availableCodes: number;
  _count: {
    sections: number;
    enrollmentCodes: number;
    enrollments: number;
  };
};

function duration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} hr`;
}

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deletingSlug, setDeletingSlug] = useState<string | null>(null);

  async function deleteCourse(course: Course) {
    if (deletingSlug) return;
    const confirmed = window.confirm(
      `Delete “${course.title}”?\n\nThis permanently removes its sections, enrollment codes, and learner records. This cannot be undone.`,
    );
    if (!confirmed) return;

    setDeletingSlug(course.slug);
    setDeleteError("");

    try {
      const response = await fetch(`/api/admin/courses/${course.slug}`, {
        method: "DELETE",
      });
      const data = await parseJsonResponse<{ success?: boolean; error?: string }>(response);
      if (!response.ok) throw new Error(data.error || "The course could not be deleted.");
      setCourses((current) => current.filter((item) => item.id !== course.id));
    } catch (caught) {
      setDeleteError(
        caught instanceof Error ? caught.message : "The course could not be deleted.",
      );
    } finally {
      setDeletingSlug(null);
    }
  }

  useEffect(() => {
    fetch("/api/admin/courses", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Courses could not be loaded.");
        setCourses(data);
      })
      .catch((caught) =>
        setError(caught instanceof Error ? caught.message : "Courses could not be loaded."),
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <AdminShell
      title="Training programs"
      eyebrow="Course library"
      actions={
        <Link
          href="/admin/courses/new"
          className="flex items-center gap-2 rounded-xl bg-[#10283f] px-4 py-3 text-sm font-bold text-white"
        >
          <Plus size={17} /> New program
        </Link>
      }
    >
      {deleteError && (
        <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
          {deleteError}
        </div>
      )}
      {loading ? (
        <div className="grid min-h-72 place-items-center">
          <LoaderCircle className="animate-spin text-[#a06e16]" size={30} />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800">
          {error}
        </div>
      ) : courses.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#10283f]/20 bg-white p-12 text-center">
          <BookOpen className="mx-auto text-[#d09a31]" size={42} />
          <h2 className="mt-5 font-serif text-3xl font-semibold text-[#10283f]">
            Build your first training program
          </h2>
          <p className="mx-auto mt-3 max-w-xl leading-7 text-[#63707a]">
            Describe what learners need to know and optionally add supporting documents.
            AI will create a professional draft you can edit before publishing.
          </p>
          <Link
            href="/admin/courses/new"
            className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[#10283f] px-5 py-3 font-bold text-white"
          >
            Create with AI <ArrowRight size={18} />
          </Link>
        </div>
      ) : (
        <section className="overflow-hidden rounded-3xl border border-[#10283f]/10 bg-white">
          <div className="hidden border-b border-[#10283f]/10 px-5 py-3 text-[11px] font-black uppercase tracking-[.13em] text-[#7a858c] lg:grid lg:grid-cols-[minmax(0,1fr)_110px_80px_90px_80px_80px_auto] lg:gap-4">
            <span>Program</span>
            <span>Status</span>
            <span>Sections</span>
            <span>Duration</span>
            <span>Codes</span>
            <span>Enrolled</span>
            <span className="text-right">Actions</span>
          </div>

          <div className="divide-y divide-[#10283f]/10">
            {courses.map((course) => (
              <article
                key={course.id}
                className="px-5 py-4 lg:grid lg:grid-cols-[minmax(0,1fr)_110px_80px_90px_80px_80px_auto] lg:items-center lg:gap-4"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate font-serif text-lg font-semibold text-[#10283f]">
                      {course.title}
                    </h2>
                    <span className="rounded-full bg-[#fff3d7] px-2 py-0.5 text-[10px] font-black uppercase tracking-[.13em] text-[#8d6012]">
                      {course.intensity}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm text-[#63707a]">
                    {course.description || "No program description yet."}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-[#7a858c] lg:hidden">
                    <span className="flex items-center gap-1.5">
                      <BookOpen size={14} className="text-[#a06e16]" />
                      {course._count.sections} sections
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock3 size={14} className="text-[#a06e16]" />
                      {duration(course.estimatedMinutes)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <KeyRound size={14} className="text-[#a06e16]" />
                      {course.availableCodes} codes
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Users size={14} className="text-[#a06e16]" />
                      {course._count.enrollments} enrolled
                    </span>
                  </div>
                </div>

                <div className="mt-3 lg:mt-0">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[.13em] ${
                      course.published
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {course.published ? "Published" : "Draft"}
                  </span>
                </div>

                <p className="hidden text-sm font-bold text-[#10283f] lg:block">
                  {course._count.sections}
                </p>
                <p className="hidden text-sm font-semibold text-[#63707a] lg:block">
                  {duration(course.estimatedMinutes)}
                </p>
                <p className="hidden text-sm font-bold text-[#10283f] lg:block">
                  {course.availableCodes}
                </p>
                <p className="hidden text-sm font-bold text-[#10283f] lg:block">
                  {course._count.enrollments}
                </p>

                <div className="mt-4 flex items-center justify-end gap-3 lg:mt-0">
                  <Link
                    href={`/admin/courses/${course.slug}`}
                    className="inline-flex items-center gap-2 text-sm font-bold text-[#10283f] hover:text-[#a06e16]"
                  >
                    Open <ArrowRight size={16} />
                  </Link>
                  <button
                    type="button"
                    onClick={() => deleteCourse(course)}
                    disabled={Boolean(deletingSlug)}
                    className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    {deletingSlug === course.slug ? (
                      <LoaderCircle className="animate-spin" size={15} />
                    ) : (
                      <Trash2 size={15} />
                    )}
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </AdminShell>
  );
}
