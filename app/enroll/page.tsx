"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, BookOpen, LoaderCircle, ShieldCheck } from "lucide-react";
import { learnerCoursePath } from "@/lib/course-routes";

type CourseSummary = {
  title: string;
  slug: string;
  description: string | null;
  estimatedMinutes: number;
  courseType?: string | null;
};

function EnrollForm() {
  const router = useRouter();
  const params = useSearchParams();
  const code = params?.get("code")?.trim().toUpperCase() || "";
  const [course, setCourse] = useState<CourseSummary | null>(null);
  const [loading, setLoading] = useState(Boolean(code));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(
    code ? "" : "No enrollment code was provided.",
  );

  useEffect(() => {
    if (!code) return;
    fetch(`/api/enroll?code=${encodeURIComponent(code)}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "This code is not valid.");
        if (data.claimed) {
          router.replace(
            data.learnerPath ||
              learnerCoursePath(data.course.slug, data.course.courseType) +
                `?code=${encodeURIComponent(code)}`,
          );
          return;
        }
        setCourse(data.course);
      })
      .catch((caught) =>
        setError(caught instanceof Error ? caught.message : "This code is not valid."),
      )
      .finally(() => setLoading(false));
  }, [code, router]);

  async function enroll(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/enroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        firstName: form.get("firstName"),
        lastName: form.get("lastName"),
        email: form.get("email"),
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Enrollment could not be completed.");
      setSubmitting(false);
      return;
    }
    router.push(
      data.learnerPath ||
        learnerCoursePath(data.course.slug, data.course.courseType) +
          `?code=${encodeURIComponent(code)}`,
    );
  }

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#10283f] text-white">
        <LoaderCircle className="animate-spin text-[#f2b744]" size={32} />
      </main>
    );
  }

  if (!course) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#10283f] px-5">
        <div className="max-w-md rounded-3xl bg-white p-8 text-center text-[#17202b]">
          <ShieldCheck className="mx-auto text-red-600" size={36} />
          <h1 className="mt-5 font-serif text-3xl font-semibold">Enrollment unavailable</h1>
          <p className="mt-3 text-[#66727b]">{error}</p>
          <button onClick={() => router.push("/")} className="mt-6 rounded-xl bg-[#10283f] px-5 py-3 font-bold text-white">
            Return to code entry
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f3efe5] px-5 py-12 text-[#17202b]">
      <div className="mx-auto grid max-w-5xl overflow-hidden rounded-[2rem] bg-white shadow-[0_30px_90px_rgba(16,40,63,.2)] lg:grid-cols-[.8fr_1.2fr]">
        <section className="bg-[#10283f] p-8 text-white sm:p-10">
          <BookOpen className="text-[#f2b744]" size={34} />
          <p className="mt-8 text-xs font-black uppercase tracking-[.18em] text-[#f2c568]">
            Your training program
          </p>
          <h1 className="mt-3 font-serif text-4xl font-semibold leading-tight">{course.title}</h1>
          <p className="mt-5 leading-7 text-slate-300">
            {course.description || "Complete the enrollment form to begin your training."}
          </p>
          <div className="mt-8 rounded-2xl bg-white/10 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Enrollment code</p>
            <p className="mt-2 font-mono text-xl font-bold tracking-wider text-[#f2c568]">{code}</p>
          </div>
          <p className="mt-5 text-xs leading-5 text-slate-400">
            Keep this code. You will use it to return to the program and continue where you stopped.
          </p>
        </section>

        <section className="p-8 sm:p-10">
          <p className="text-xs font-black uppercase tracking-[.18em] text-[#9a6812]">Claim your seat</p>
          <h2 className="mt-2 font-serif text-3xl font-semibold text-[#10283f]">Tell us who is enrolling</h2>
          <form onSubmit={enroll} className="mt-8 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className="mb-2 block text-sm font-bold">First name</span>
                <input name="firstName" required autoComplete="given-name" className="w-full rounded-xl border border-[#10283f]/15 px-4 py-3 outline-none focus:border-[#c68b1b]" />
              </label>
              <label>
                <span className="mb-2 block text-sm font-bold">Last name</span>
                <input name="lastName" required autoComplete="family-name" className="w-full rounded-xl border border-[#10283f]/15 px-4 py-3 outline-none focus:border-[#c68b1b]" />
              </label>
            </div>
            <label className="block">
              <span className="mb-2 block text-sm font-bold">Email address</span>
              <input name="email" type="email" required autoComplete="email" className="w-full rounded-xl border border-[#10283f]/15 px-4 py-3 outline-none focus:border-[#c68b1b]" />
            </label>
            {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
            <button disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#d9a036] px-5 py-4 font-bold text-[#10283f] disabled:opacity-60">
              {submitting ? <LoaderCircle className="animate-spin" size={19} /> : <ArrowRight size={19} />}
              {submitting ? "Creating enrollment…" : "Enroll and begin"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}

export default function EnrollPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#10283f]" />}>
      <EnrollForm />
    </Suspense>
  );
}
