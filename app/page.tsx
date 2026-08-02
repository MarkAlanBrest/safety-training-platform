"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Award, BookOpenCheck, KeyRound } from "lucide-react";
import { parseJsonResponse } from "@/lib/parse-response";

const steps = [
  {
    number: "01",
    title: "Enter your code",
    text: "Use the course code provided by your instructor or employer.",
  },
  {
    number: "02",
    title: "Complete your training",
    text: "Move through clear lessons and knowledge checks at your pace.",
  },
  {
    number: "03",
    title: "Get your certificate",
    text: "Finish the course and keep a record of your completion.",
  },
];

export default function HomePage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const normalizedCode = code.trim();
    if (!normalizedCode) {
      setError("Enter the course code you received.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/enroll?code=${encodeURIComponent(normalizedCode)}`);
      const data = await parseJsonResponse<{
        error?: string;
        claimed?: boolean;
        course?: { slug: string };
      }>(response);

      if (!response.ok || data.error) {
        setError(data.error || "That course code was not recognized.");
        setLoading(false);
        return;
      }

      if (data.claimed && data.course) {
        router.push(`/training/${data.course.slug}?code=${encodeURIComponent(normalizedCode)}`);
      } else {
        router.push(`/enroll?code=${encodeURIComponent(normalizedCode)}`);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not connect. Please try again.");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-white text-[#30343b]">
      <header className="relative z-20 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-5 py-4 sm:px-8 lg:px-10">
          <Link href="/" aria-label="NCST Online Training home">
            <Image
              src="/images/ncst-logo.png"
              alt="New Castle School of Trades"
              width={188}
              height={56}
              className="h-11 w-auto sm:h-12"
              priority
            />
          </Link>

          <div className="flex items-center gap-5">
            <span className="hidden text-sm font-semibold text-[#68717d] sm:block">
              Online Training Portal
            </span>
            <Link
              href="/admin/login"
              className="font-[family-name:var(--font-oswald)] text-sm font-medium uppercase tracking-[.08em] text-[#002d74] transition hover:text-[#d98500]"
            >
              Admin sign in
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden bg-[#002d74]">
        <div className="pointer-events-none absolute -left-24 top-24 h-72 w-72 rounded-full border-[48px] border-white/[.035]" />
        <div className="pointer-events-none absolute right-[-8rem] top-[-8rem] h-96 w-96 rounded-full bg-[#0b4087]" />

        <div className="relative mx-auto grid max-w-7xl gap-10 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[1fr_480px] lg:items-center lg:gap-16 lg:px-10 lg:py-20">
          <div className="max-w-2xl text-white">
            <p className="flex items-center gap-3 font-[family-name:var(--font-oswald)] text-sm font-medium uppercase tracking-[.18em] text-[#faa200]">
              <span className="h-0.5 w-8 bg-[#faa200]" />
              NCST Online Training
            </p>
            <h1 className="mt-6 text-5xl font-semibold uppercase leading-[.98] tracking-[-.025em] text-white sm:text-6xl lg:text-7xl">
              Build skills.
              <span className="block text-[#faa200]">Work safer.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-white/72 sm:text-xl">
              Access the safety and compliance training assigned by New Castle School
              of Trades or your employer—all in one place.
            </p>

            <div className="mt-8 flex flex-wrap gap-x-7 gap-y-3 text-sm font-bold text-white/80">
              <span className="flex items-center gap-2">
                <BookOpenCheck size={18} className="text-[#faa200]" /> Self-paced lessons
              </span>
              <span className="flex items-center gap-2">
                <Award size={18} className="text-[#faa200]" /> Completion certificates
              </span>
            </div>
          </div>

          <div className="overflow-hidden bg-white shadow-[0_28px_70px_rgba(0,0,0,.28)]">
            <div className="relative h-36 sm:h-44">
              <Image
                src="/images/ncst-campus-hero.jpg"
                alt="New Castle School of Trades campus"
                fill
                sizes="(max-width: 1024px) 100vw, 480px"
                className="object-cover"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#001d4c]/60 to-transparent" />
              <p className="absolute bottom-4 left-5 text-sm font-bold text-white">
                New Castle School of Trades
              </p>
            </div>

            <div className="p-6 sm:p-8">
              <div className="flex items-start gap-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#eef3f9] text-[#002d74]">
                  <KeyRound size={20} />
                </span>
                <div>
                  <h2 className="text-2xl font-semibold uppercase text-[#002d74]">
                    Start your course
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-[#68717d]">
                    Enter the code you received to continue.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="mt-6">
                <label
                  htmlFor="course-code"
                  className="font-[family-name:var(--font-oswald)] text-xs font-semibold uppercase tracking-[.12em] text-[#4f5965]"
                >
                  Course code
                </label>
                <input
                  id="course-code"
                  type="text"
                  autoComplete="off"
                  placeholder="EXAMPLE-123"
                  className="mt-2 w-full border-2 border-[#d8dce1] bg-[#fafafa] px-4 py-3.5 text-base font-bold uppercase tracking-[.12em] text-[#20242a] outline-none transition placeholder:font-normal placeholder:tracking-normal placeholder:text-[#9aa0a8] focus:border-[#faa200] focus:bg-white"
                  value={code}
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                  aria-describedby={error ? "course-code-error" : "course-code-help"}
                />
                <p id="course-code-help" className="mt-2 text-xs text-[#7b838c]">
                  Codes are not case-sensitive.
                </p>
                {error && (
                  <p id="course-code-error" role="alert" className="mt-2 text-sm font-bold text-[#c52a31]">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 bg-[#faa200] px-5 py-3.5 font-[family-name:var(--font-oswald)] text-base font-semibold uppercase tracking-[.08em] text-[#002d74] transition hover:bg-[#ffb72e] disabled:cursor-wait disabled:opacity-60"
                >
                  {loading ? "Checking…" : "Continue"}
                  {!loading && <ArrowRight size={18} />}
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-[#002d74]/10 bg-[#f6f7f8]">
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-16 lg:px-10">
          <div className="grid gap-8 md:grid-cols-[.7fr_1.3fr] md:items-start lg:gap-16">
            <div>
              <p className="font-[family-name:var(--font-oswald)] text-sm font-semibold uppercase tracking-[.15em] text-[#d98500]">
                Simple from start to finish
              </p>
              <h2 className="mt-3 text-3xl font-semibold uppercase leading-tight text-[#002d74] sm:text-4xl">
                Your training,
                <span className="block">three clear steps.</span>
              </h2>
            </div>

            <div className="grid gap-7 sm:grid-cols-3">
              {steps.map((step) => (
                <article key={step.number} className="border-l-2 border-[#d9dde2] pl-5">
                  <p className="font-[family-name:var(--font-oswald)] text-sm font-semibold text-[#d98500]">
                    {step.number}
                  </p>
                  <h3 className="mt-2 text-lg font-semibold uppercase text-[#002d74]">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[#68717d]">{step.text}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-7 text-sm text-[#737b85] sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
          <p>&copy; {new Date().getFullYear()} New Castle School of Trades</p>
          <p>Safety and compliance training portal</p>
        </div>
      </footer>
    </main>
  );
}
