"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Award,
  BookOpen,
  Check,
  GraduationCap,
  KeyRound,
  Laptop,
  Presentation,
  Users,
} from "lucide-react";

const trainingTypes = [
  {
    icon: Users,
    title: "Onboarding",
    text: "Give every new hire a clear and consistent start.",
  },
  {
    icon: BookOpen,
    title: "Workforce training",
    text: "Turn policies and expertise into practical learning.",
  },
  {
    icon: Award,
    title: "Custom programs",
    text: "Build role-specific courses with trackable completion.",
  },
];

const deliveryOptions = [
  { icon: Laptop, label: "Self-paced online" },
  { icon: Presentation, label: "Instructor-led" },
  { icon: BookOpen, label: "Blended learning" },
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
      const response = await fetch(`/api/enroll?code=${encodeURIComponent(code)}`);
      const data = await response.json();

      if (!response.ok || data.error) {
        setError("That course code was not recognized.");
        setLoading(false);
        return;
      }

      if (data.claimed) {
        router.push(`/training/${data.course.slug}?code=${encodeURIComponent(code)}`);
      } else {
        router.push(`/enroll?code=${encodeURIComponent(code)}`);
      }
    } catch {
      setError("We could not connect. Please try again.");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f8faf8] text-[#17231f]">
      <header className="border-b border-[#173d33]/10 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="Career Training home">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#173d33] text-[#f4c875]">
              <GraduationCap size={22} strokeWidth={2.2} />
            </span>
            <span className="text-base font-extrabold tracking-tight text-[#173d33]">
              Career Training
            </span>
          </Link>

          <nav className="flex items-center gap-5" aria-label="Primary navigation">
            <a
              href="#programs"
              className="hidden text-sm font-semibold text-[#596761] transition hover:text-[#173d33] sm:block"
            >
              Programs
            </a>
            <Link
              href="/admin/login"
              className="rounded-lg border border-[#173d33]/15 bg-white px-4 py-2.5 text-sm font-bold text-[#173d33] transition hover:border-[#173d33]/35 hover:bg-[#f4f7f5]"
            >
              Admin sign in
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-[#173d33]/8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_15%,rgba(225,178,90,.16),transparent_32rem)]" />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[1.08fr_.92fr] lg:items-center lg:py-24">
          <div>
            <p className="text-sm font-bold text-[#3d7664]">Training made for your team</p>
            <h1 className="mt-4 max-w-2xl text-4xl font-black leading-[1.05] tracking-[-.04em] text-[#173d33] sm:text-5xl lg:text-6xl">
              Practical learning, built around your organization.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-[#596761]">
              Clear, engaging courses for onboarding, employee development, safety,
              and the skills your people need most.
            </p>

            <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-[#35463f]">
              {["Fully customizable", "Flexible delivery", "Completion certificates"].map(
                (item) => (
                  <span key={item} className="flex items-center gap-2">
                    <Check size={16} strokeWidth={2.8} className="text-[#3d7664]" />
                    {item}
                  </span>
                ),
              )}
            </div>

            <a
              href="#programs"
              className="mt-9 inline-flex items-center gap-2 text-sm font-extrabold text-[#173d33] transition hover:gap-3"
            >
              See what we offer <ArrowRight size={17} />
            </a>
          </div>

          <div className="rounded-3xl border border-[#173d33]/10 bg-white p-6 shadow-[0_24px_70px_rgba(23,61,51,.12)] sm:p-8">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#eef4f0] text-[#3d7664]">
              <KeyRound size={21} />
            </span>
            <h2 className="mt-5 text-2xl font-extrabold tracking-tight text-[#173d33]">
              Start your course
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#68756f]">
              Enter the code provided by your instructor or organization.
            </p>

            <form onSubmit={handleSubmit} className="mt-6">
              <label htmlFor="course-code" className="text-sm font-bold text-[#35463f]">
                Course code
              </label>
              <input
                id="course-code"
                type="text"
                autoComplete="off"
                placeholder="EXAMPLE-123"
                className="mt-2 w-full rounded-xl border border-[#173d33]/15 bg-[#fbfcfb] px-4 py-3.5 font-bold uppercase tracking-[.1em] text-[#17231f] outline-none transition placeholder:font-medium placeholder:tracking-normal placeholder:text-[#9aa49f] focus:border-[#3d7664] focus:ring-4 focus:ring-[#3d7664]/10"
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                aria-describedby={error ? "course-code-error" : undefined}
              />
              {error && (
                <p id="course-code-error" role="alert" className="mt-2 text-sm font-semibold text-[#a34335]">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#173d33] px-5 py-3.5 font-extrabold text-white transition hover:bg-[#245548] disabled:cursor-wait disabled:opacity-60"
              >
                {loading ? "Checking…" : "Continue to course"}
                {!loading && <ArrowRight size={17} />}
              </button>
            </form>
          </div>
        </div>
      </section>

      <section id="programs" className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-bold text-[#3d7664]">Built to fit</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-.03em] text-[#173d33] sm:text-4xl">
              One platform for the training you need.
            </h2>
            <p className="mt-4 text-base leading-7 text-[#68756f]">
              We shape your materials and expertise into focused learning that is easy
              to deliver, complete, and track.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {trainingTypes.map(({ icon: Icon, title, text }) => (
              <article key={title} className="rounded-2xl border border-[#173d33]/10 bg-[#fbfcfb] p-6">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#eef4f0] text-[#3d7664]">
                  <Icon size={20} />
                </span>
                <h3 className="mt-5 text-lg font-extrabold text-[#173d33]">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#68756f]">{text}</p>
              </article>
            ))}
          </div>

          <div className="mt-8 flex flex-col gap-5 rounded-2xl bg-[#173d33] px-6 py-6 text-white sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <div>
              <p className="font-extrabold">Learn in the format that works best.</p>
              <p className="mt-1 text-sm text-white/60">For one learner, one team, or an entire organization.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {deliveryOptions.map(({ icon: Icon, label }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[.07] px-3 py-2 text-xs font-bold text-white/80"
                >
                  <Icon size={14} className="text-[#f4c875]" /> {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-[#173d33]/10 bg-[#f8faf8]">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="flex items-center gap-2.5 font-extrabold text-[#173d33]">
            <GraduationCap size={19} /> Career Training
          </div>
          <div className="flex items-center gap-5 font-semibold text-[#68756f]">
            <a href="#programs" className="transition hover:text-[#173d33]">Programs</a>
            <Link href="/admin/login" className="transition hover:text-[#173d33]">Admin sign in</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
