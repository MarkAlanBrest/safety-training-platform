"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Award, BookOpen, ClipboardCheck, ShieldCheck } from "lucide-react";

const highlights = [
  {
    icon: BookOpen,
    title: "Assigned courses",
    text: "Access the safety and compliance training your school or employer assigned to you.",
  },
  {
    icon: ClipboardCheck,
    title: "Learn at your pace",
    text: "Work through interactive lessons, knowledge checks, and narrated visuals on your schedule.",
  },
  {
    icon: Award,
    title: "Finish with proof",
    text: "Complete each program and keep a record of your progress and certificate.",
  },
];

export default function HomePage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!code.trim()) {
      setError("Enter the course code you received.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/enroll?code=${encodeURIComponent(code.trim())}`);
      const data = await response.json();

      if (!response.ok || data.error) {
        setError(data.error || "That course code was not recognized.");
        setLoading(false);
        return;
      }

      if (data.claimed && data.course) {
        router.push(`/training/${data.course.slug}?code=${encodeURIComponent(code.trim())}`);
      } else {
        router.push(`/enroll?code=${encodeURIComponent(code.trim())}`);
      }
    } catch {
      setError("We could not connect. Please try again.");
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col bg-[#f2f2f2] text-[#404040]">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#002d74] shadow-[0_4px_20px_rgba(0,0,0,0.12)]">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <Link href="/" className="shrink-0" aria-label="NCST Online Training home">
              <Image
                src="/ncst-logo.png"
                alt="New Castle School of Trades"
                width={180}
                height={54}
                className="h-11 w-auto sm:h-12"
                priority
              />
            </Link>

            <p className="hidden max-w-sm text-center text-sm leading-6 text-white/75 lg:block">
              Online safety training for students and employees
            </p>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              <form
                onSubmit={handleSubmit}
                className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center lg:flex-none"
              >
                <label htmlFor="course-code" className="sr-only">
                  Course code
                </label>
                <input
                  id="course-code"
                  type="text"
                  autoComplete="off"
                  placeholder="Course code"
                  className="min-w-0 flex-1 border-2 border-white/20 bg-white px-4 py-2.5 font-bold uppercase tracking-wider text-[#111] outline-none placeholder:font-normal placeholder:normal-case placeholder:tracking-normal placeholder:text-[#888] focus:border-[#faa200] sm:w-44 sm:flex-none lg:w-48"
                  value={code}
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                  aria-describedby={error ? "course-code-error" : undefined}
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center justify-center gap-2 bg-[#faa200] px-5 py-3 font-[family-name:var(--font-oswald)] text-sm font-medium uppercase tracking-wide text-[#002d74] transition hover:bg-[#ffb62e] disabled:cursor-wait disabled:opacity-60"
                >
                  {loading ? "Checking…" : "Start course"}
                  {!loading && <ArrowRight size={16} />}
                </button>
              </form>
              <Link
                href="/admin/login"
                className="text-center font-[family-name:var(--font-oswald)] text-xs font-medium uppercase tracking-wide text-[#faa200] hover:underline sm:text-sm"
              >
                Admin login
              </Link>
            </div>
          </div>

          {error && (
            <p id="course-code-error" role="alert" className="mt-3 text-sm font-semibold text-[#ffb4b4]">
              {error}
            </p>
          )}
        </div>
      </header>

      <div className="flex flex-1 items-center px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto w-full max-w-5xl">
          <div className="text-center">
            <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-[#002d74]/15 bg-white px-4 py-2 text-sm font-semibold text-[#002d74] shadow-sm">
              <ShieldCheck size={16} className="text-[#faa200]" />
              NCST Online Training Portal
            </div>
            <h1 className="font-[family-name:var(--font-oswald)] text-4xl font-medium uppercase leading-tight text-[#002d74] sm:text-5xl lg:text-6xl">
              Safety training built for real workplaces
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-[#636363] sm:text-xl">
              Assigned compliance and safety courses for New Castle School of Trades
              students and partner employers. Enter the code from your instructor or
              enrollment email to begin.
            </p>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-3">
            {highlights.map((item) => (
              <article
                key={item.title}
                className="bg-white p-6 shadow-[0_5px_15px_rgba(0,0,0,0.08)] sm:p-7"
              >
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#002d74]/8 text-[#002d74]">
                  <item.icon size={22} strokeWidth={1.8} />
                </span>
                <h2 className="mt-4 font-[family-name:var(--font-oswald)] text-xl font-medium uppercase text-[#002d74]">
                  {item.title}
                </h2>
                <p className="mt-3 text-base leading-7 text-[#636363]">{item.text}</p>
              </article>
            ))}
          </div>

          <div className="mt-10 border-l-4 border-[#faa200] bg-white px-6 py-5 shadow-[0_5px_15px_rgba(0,0,0,0.06)] sm:px-8">
            <p className="font-[family-name:var(--font-oswald)] text-sm font-medium uppercase tracking-wide text-[#002d74]">
              Ready to begin?
            </p>
            <p className="mt-2 max-w-3xl text-base leading-7 text-[#636363]">
              Enter your course code in the toolbar above and select{" "}
              <strong className="font-semibold text-[#002d74]">Start course</strong>. First-time
              visitors may be asked for a few details before their seat is confirmed.
            </p>
          </div>
        </div>
      </div>

      <footer className="bg-[#002d74] px-4 py-5 text-center text-sm text-white/60 sm:px-6">
        <p>&copy; {new Date().getFullYear()} New Castle School of Trades</p>
      </footer>
    </main>
  );
}
