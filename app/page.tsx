"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Award,
  BookOpen,
  Building2,
  Check,
  KeyRound,
  Laptop,
  Palette,
  Presentation,
  RefreshCw,
  Sparkles,
  Users,
} from "lucide-react";

const trainingTypes = [
  {
    icon: Users,
    title: "Employee onboarding",
    text: "Give every new hire a consistent, confident start with training built around your organization.",
  },
  {
    icon: Award,
    title: "Employee training",
    text: "Turn policies, processes, and expertise into clear courses people can apply on the job.",
  },
  {
    icon: RefreshCw,
    title: "Refresher courses",
    text: "Reinforce important knowledge, introduce updates, and keep essential skills current.",
  },
  {
    icon: Sparkles,
    title: "Custom programs",
    text: "Build a focused learning experience for a specific role, initiative, standard, or business need.",
  },
];

const deliveryOptions = [
  {
    icon: Laptop,
    label: "Online",
    text: "Self-paced learning available wherever your people work.",
  },
  {
    icon: Presentation,
    label: "In person",
    text: "Instructor-led sessions designed for active participation.",
  },
  {
    icon: BookOpen,
    label: "Blended",
    text: "Combine live instruction with online learning and follow-up.",
  },
];

const platformFeatures = [
  "Company branding and visual identity",
  "Content shaped around your policies and processes",
  "Knowledge checks and final assessments",
  "Trackable progress and completion records",
  "Printable certificates of completion",
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
    <main className="min-h-screen bg-white text-[#404040]">
      {/* Top bar */}
      <div className="bg-[#faa200] text-[#002d74]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-6 gap-y-1 px-4 py-2 text-sm font-bold sm:px-6">
          <span>Hands-on career training since 1945</span>
          <span className="hidden sm:inline">|</span>
          <span>Online, in person, or blended delivery</span>
        </div>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#002d74] shadow-[0_5px_10px_rgba(0,0,0,0.25)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="shrink-0">
            <Image
              src="/images/ncst-logo.png"
              alt="New Castle School of Trades"
              width={200}
              height={60}
              className="h-12 w-auto sm:h-14"
              priority
            />
          </Link>

          <nav className="hidden items-center gap-6 lg:flex">
            <a
              href="#solutions"
              className="font-[family-name:var(--font-oswald)] text-sm font-medium uppercase tracking-wide text-white hover:text-[#faa200]"
            >
              Solutions
            </a>
            <a
              href="#delivery"
              className="font-[family-name:var(--font-oswald)] text-sm font-medium uppercase tracking-wide text-white hover:text-[#faa200]"
            >
              Delivery
            </a>
            <a
              href="#platform"
              className="font-[family-name:var(--font-oswald)] text-sm font-medium uppercase tracking-wide text-white hover:text-[#faa200]"
            >
              Platform
            </a>
            <a
              href="#learner-access"
              className="font-[family-name:var(--font-oswald)] text-sm font-medium uppercase tracking-wide text-white hover:text-[#faa200]"
            >
              Learner Access
            </a>
            <Link
              href="/admin/login"
              className="rounded border-2 border-[#faa200] px-4 py-2 font-[family-name:var(--font-oswald)] text-sm font-medium uppercase tracking-wide text-[#faa200] transition hover:bg-[#faa200] hover:text-[#002d74]"
            >
              Administrator
            </Link>
          </nav>

          <Link
            href="/admin/login"
            className="rounded border-2 border-[#faa200] px-3 py-1.5 font-[family-name:var(--font-oswald)] text-xs font-medium uppercase tracking-wide text-[#faa200] transition hover:bg-[#faa200] hover:text-[#002d74] lg:hidden"
          >
            Admin
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src="/images/ncst-campus-hero.jpg"
            alt=""
            fill
            className="object-cover object-center"
            priority
          />
          <div className="absolute inset-0 bg-[#002d74]/85" />
        </div>

        <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.1fr_.9fr] lg:items-center lg:py-24">
          <div>
            <p className="inline-flex items-center gap-2 border border-[#faa200]/40 bg-[#faa200]/15 px-4 py-2 font-[family-name:var(--font-oswald)] text-xs font-medium uppercase tracking-[.15em] text-[#faa200]">
              <Sparkles size={14} /> Career Training Platform
            </p>
            <h1 className="mt-6 font-[family-name:var(--font-oswald)] text-4xl font-medium uppercase leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
              Training built around the way your organization works.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/75">
              From onboarding and employee development to refreshers and fully
              custom courses, create learning that fits your people, goals, and
              brand — powered by New Castle School of Trades.
            </p>

            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm font-bold text-white/90">
              {["One learner or hundreds", "Online, in person, or both", "Certificates included"].map(
                (item) => (
                  <li key={item} className="flex items-center gap-2">
                    <span className="grid h-5 w-5 place-items-center bg-[#faa200] text-[#002d74]">
                      <Check size={13} strokeWidth={3} />
                    </span>
                    {item}
                  </li>
                ),
              )}
            </ul>

            <a
              href="#solutions"
              className="ncst-btn ncst-btn-orange mt-10 inline-flex items-center gap-2"
            >
              Explore training options <ArrowRight size={17} />
            </a>
          </div>

          <div id="learner-access" className="bg-white p-7 shadow-[0_5px_15px_rgba(0,0,0,0.25)] sm:p-9">
            <p className="flex items-center gap-2 font-[family-name:var(--font-oswald)] text-xs font-medium uppercase tracking-[.15em] text-[#faa200]">
              <KeyRound size={15} /> Learner access
            </p>
            <h2 className="mt-4 font-[family-name:var(--font-oswald)] text-2xl font-medium uppercase text-[#002d74]">
              Ready to begin?
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#636363]">
              Enter the course code supplied by your instructor or organization.
            </p>

            <form onSubmit={handleSubmit} className="mt-6">
              <label
                htmlFor="course-code"
                className="text-sm font-bold uppercase tracking-wide text-[#002d74]"
              >
                Course code
              </label>
              <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                <input
                  id="course-code"
                  type="text"
                  autoComplete="off"
                  placeholder="EXAMPLE-123"
                  className="min-w-0 flex-1 border-2 border-[#b1b4ba] bg-white px-4 py-3 font-bold uppercase tracking-wider text-[#111] outline-none focus:border-[#faa200]"
                  value={code}
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="ncst-btn ncst-btn-filled inline-flex items-center justify-center gap-2 px-6 disabled:cursor-wait disabled:opacity-60"
                >
                  {loading ? "Checking…" : "Start course"}
                  {!loading && <ArrowRight size={17} />}
                </button>
              </div>
              {error && (
                <p role="alert" className="mt-3 text-sm font-semibold text-[#ed1c24]">
                  {error}
                </p>
              )}
            </form>

            <div className="mt-8 grid grid-cols-3 gap-3 border-t border-[#e0e0e0] pt-6 text-center">
              <div>
                <p className="font-[family-name:var(--font-oswald)] text-2xl font-medium text-[#002d74]">1–100s</p>
                <p className="mt-1 text-xs text-[#636363]">Learners</p>
              </div>
              <div>
                <p className="font-[family-name:var(--font-oswald)] text-2xl font-medium text-[#002d74]">3</p>
                <p className="mt-1 text-xs text-[#636363]">Delivery modes</p>
              </div>
              <div>
                <p className="font-[family-name:var(--font-oswald)] text-2xl font-medium text-[#002d74]">100%</p>
                <p className="mt-1 text-xs text-[#636363]">Customizable</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Solutions */}
      <section id="solutions" className="bg-[#f2f2f2] py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid gap-8 lg:grid-cols-[.8fr_1.2fr] lg:items-end">
            <div>
              <p className="font-[family-name:var(--font-oswald)] text-sm font-medium uppercase tracking-[.15em] text-[#faa200]">
                Built for your need
              </p>
              <h2 className="mt-3 font-[family-name:var(--font-oswald)] text-3xl font-medium uppercase text-[#002d74] sm:text-4xl">
                If it can be taught, it can become a course.
              </h2>
            </div>
            <p className="max-w-2xl text-lg leading-8 text-[#636363] lg:justify-self-end">
              Start with your existing materials and subject-matter expertise. We
              shape them into clear, engaging learning experiences with activities,
              assessments, and measurable completion.
            </p>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {trainingTypes.map(({ icon: Icon, title, text }, index) => (
              <article
                key={title}
                className="border border-[#e0e0e0] bg-white p-6 shadow-[0_5px_15px_rgba(0,0,0,0.08)] transition hover:-translate-y-1 hover:shadow-[0_8px_20px_rgba(0,45,116,0.12)]"
              >
                <div className="flex items-center justify-between">
                  <span className="grid h-12 w-12 place-items-center bg-[#002d74] text-[#faa200]">
                    <Icon size={23} />
                  </span>
                  <span className="font-[family-name:var(--font-oswald)] text-sm font-medium text-[#002d74]/20">
                    0{index + 1}
                  </span>
                </div>
                <h3 className="mt-6 font-[family-name:var(--font-oswald)] text-lg font-medium uppercase text-[#002d74]">
                  {title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-[#636363]">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Delivery */}
      <section id="delivery" className="py-16 sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-14 px-4 sm:px-6 lg:grid-cols-[.9fr_1.1fr] lg:items-center">
          <div>
            <p className="font-[family-name:var(--font-oswald)] text-sm font-medium uppercase tracking-[.15em] text-[#faa200]">
              Flexible delivery
            </p>
            <h2 className="mt-3 font-[family-name:var(--font-oswald)] text-3xl font-medium uppercase text-[#002d74] sm:text-4xl">
              Meet your learners where they are.
            </h2>
            <p className="mt-6 max-w-xl text-lg leading-8 text-[#636363]">
              Train one person, one team, or hundreds across locations. Choose the
              format that works — or combine formats into one connected program.
            </p>
          </div>

          <div className="grid gap-4">
            {deliveryOptions.map(({ icon: Icon, label, text }) => (
              <article
                key={label}
                className="flex gap-5 border border-[#e0e0e0] bg-[#f2f2f2] p-6 sm:items-center"
              >
                <span className="grid h-13 w-13 shrink-0 place-items-center bg-[#002d74] text-[#faa200]">
                  <Icon size={24} />
                </span>
                <div>
                  <h3 className="font-[family-name:var(--font-oswald)] text-lg font-medium uppercase text-[#002d74]">
                    {label}
                  </h3>
                  <p className="mt-1.5 leading-6 text-[#636363]">{text}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Platform / branding */}
      <section id="platform" className="bg-[#002d74] py-16 text-white sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:items-center">
          <div>
            <span className="grid h-14 w-14 place-items-center bg-[#faa200] text-[#002d74]">
              <Palette size={27} />
            </span>
            <p className="mt-7 font-[family-name:var(--font-oswald)] text-sm font-medium uppercase tracking-[.15em] text-[#faa200]">
              Your organization. Your course.
            </p>
            <h2 className="mt-4 max-w-xl font-[family-name:var(--font-oswald)] text-3xl font-medium uppercase sm:text-4xl">
              Training that feels like it belongs to your organization.
            </h2>
            <p className="mt-6 max-w-xl text-lg leading-8 text-white/70">
              Courses can be branded with your company identity and tailored to
              your language, standards, examples, and expectations.
            </p>
          </div>

          <div className="border border-white/15 bg-white/[.06] p-7 sm:p-9">
            <p className="flex items-center gap-2 text-sm font-bold text-white/50">
              <Building2 size={17} /> Custom course experience
            </p>
            <ul className="mt-7 space-y-3">
              {platformFeatures.map((item) => (
                <li
                  key={item}
                  className="flex gap-3 bg-white/[.06] px-4 py-3.5"
                >
                  <Check className="mt-0.5 shrink-0 text-[#faa200]" size={18} strokeWidth={3} />
                  <span className="font-semibold text-white/85">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Certificate CTA */}
      <section className="bg-[#faa200] py-12">
        <div className="mx-auto flex max-w-7xl flex-col gap-7 px-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="font-[family-name:var(--font-oswald)] text-sm font-medium uppercase tracking-[.15em] text-[#002d74]/70">
              Learning that leads somewhere
            </p>
            <h2 className="mt-3 font-[family-name:var(--font-oswald)] text-2xl font-medium uppercase text-[#002d74] sm:text-3xl">
              Every completed course can end with a certificate.
            </h2>
          </div>
          <div className="flex items-center gap-4 bg-[#002d74] px-5 py-4 text-white">
            <Award size={31} className="shrink-0 text-[#faa200]" />
            <div>
              <p className="font-[family-name:var(--font-oswald)] font-medium uppercase">
                Certificate of completion
              </p>
              <p className="text-sm text-white/70">A clear record of learner achievement</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="border-b border-[#e0e0e0] bg-white py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-center gap-4 px-4 sm:flex-row sm:gap-6 sm:px-6">
          <a href="#solutions" className="ncst-btn w-full max-w-xs text-center sm:w-auto">
            Explore Solutions
          </a>
          <a href="#learner-access" className="ncst-btn ncst-btn-filled w-full max-w-xs text-center sm:w-auto">
            Start a Course
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#002d74] text-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
          <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
            <div className="flex items-center gap-4">
              <Image
                src="/images/ncst-logo.png"
                alt="New Castle School of Trades"
                width={160}
                height={48}
                className="h-10 w-auto brightness-0 invert"
              />
              <div>
                <p className="font-[family-name:var(--font-oswald)] font-medium uppercase">
                  Career Training Platform
                </p>
                <p className="text-sm text-white/55">
                  Flexible training for every organization
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-8 text-sm">
              <div>
                <p className="mb-2 font-[family-name:var(--font-oswald)] text-xs font-medium uppercase tracking-wide text-[#faa200]">
                  Platform
                </p>
                <ul className="space-y-1.5">
                  <li>
                    <a href="#solutions" className="text-white/75 hover:text-[#faa200]">
                      Solutions
                    </a>
                  </li>
                  <li>
                    <a href="#delivery" className="text-white/75 hover:text-[#faa200]">
                      Delivery
                    </a>
                  </li>
                  <li>
                    <a href="#learner-access" className="text-white/75 hover:text-[#faa200]">
                      Learner Access
                    </a>
                  </li>
                </ul>
              </div>
              <div>
                <p className="mb-2 font-[family-name:var(--font-oswald)] text-xs font-medium uppercase tracking-wide text-[#faa200]">
                  Administration
                </p>
                <ul className="space-y-1.5">
                  <li>
                    <Link href="/admin/login" className="text-white/75 hover:text-[#faa200]">
                      Administrator Login
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-[#0c3485] py-6 text-center text-sm text-white/55">
          <p>
            &copy; {new Date().getFullYear()} New Castle School of Trades. All
            rights reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}
