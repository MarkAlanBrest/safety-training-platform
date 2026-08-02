"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Award,
  BookOpen,
  Building2,
  Check,
  GraduationCap,
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
    icon: GraduationCap,
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
    <main className="min-h-screen overflow-hidden bg-[#f6f3ec] text-[#18251f]">
      <header className="relative z-20 border-b border-[#18251f]/10 bg-[#f6f3ec]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-5 py-5 sm:px-8 lg:px-10">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#183c33] text-[#f3bd61]">
              <GraduationCap size={24} strokeWidth={2.2} />
            </span>
            <span>
              <span className="block text-base font-extrabold tracking-tight text-[#183c33]">
                Career Training
              </span>
              <span className="hidden text-xs font-medium text-[#627068] sm:block">
                Learning built for your organization
              </span>
            </span>
          </Link>

          <nav className="flex items-center gap-3">
            <a
              href="#solutions"
              className="hidden text-sm font-semibold text-[#536159] hover:text-[#183c33] md:block"
            >
              Solutions
            </a>
            <a
              href="#delivery"
              className="hidden text-sm font-semibold text-[#536159] hover:text-[#183c33] md:block"
            >
              Delivery
            </a>
            <Link
              href="/admin/login"
              className="rounded-full border border-[#183c33]/20 px-4 py-2.5 text-sm font-bold text-[#183c33] transition hover:border-[#183c33] hover:bg-white"
            >
              Administrator
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative">
        <div className="absolute -right-36 -top-40 h-[520px] w-[520px] rounded-full bg-[#efb85d]/20 blur-3xl" />
        <div className="absolute -left-52 bottom-0 h-[420px] w-[420px] rounded-full bg-[#6fa693]/15 blur-3xl" />

        <div className="relative mx-auto grid max-w-7xl gap-14 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[1.1fr_.9fr] lg:items-center lg:px-10 lg:py-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-[#183c33]/15 bg-white/70 px-4 py-2 text-xs font-extrabold uppercase tracking-[.17em] text-[#356555]">
              <Sparkles size={14} /> Training without the template
            </p>
            <h1 className="mt-7 max-w-3xl text-5xl font-black leading-[.98] tracking-[-.045em] text-[#183c33] sm:text-6xl lg:text-7xl">
              Training built around the way your organization works.
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-[#536159] sm:text-xl">
              From onboarding and employee development to refreshers and fully
              custom courses, create learning that fits your people, goals, and
              brand.
            </p>

            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm font-bold text-[#33463d]">
              {["One learner or hundreds", "Online, in person, or both", "Certificates included"].map(
                (item) => (
                  <span key={item} className="flex items-center gap-2">
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-[#dceadf] text-[#356555]">
                      <Check size={13} strokeWidth={3} />
                    </span>
                    {item}
                  </span>
                ),
              )}
            </div>

            <a
              href="#solutions"
              className="mt-10 inline-flex items-center gap-2 rounded-full bg-[#183c33] px-6 py-3.5 text-sm font-extrabold text-white shadow-[0_16px_35px_rgba(24,60,51,.2)] transition hover:-translate-y-0.5 hover:bg-[#235244]"
            >
              Explore training options <ArrowRight size={17} />
            </a>
          </div>

          <div className="relative mx-auto w-full max-w-lg">
            <div className="absolute -left-7 top-12 hidden rounded-2xl bg-[#efb85d] p-4 text-[#3b2a0d] shadow-xl sm:block">
              <Award size={24} />
            </div>
            <div className="rounded-[2rem] bg-[#183c33] p-7 text-white shadow-[0_35px_90px_rgba(24,37,31,.28)] sm:p-9">
              <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.18em] text-[#efc779]">
                <KeyRound size={15} /> Learner access
              </p>
              <h2 className="mt-5 text-3xl font-bold tracking-tight">Ready to begin?</h2>
              <p className="mt-3 leading-7 text-white/65">
                Enter the course code supplied by your instructor or organization.
              </p>

              <form onSubmit={handleSubmit} className="mt-7">
                <label htmlFor="course-code" className="text-sm font-bold text-white/80">
                  Course code
                </label>
                <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                  <input
                    id="course-code"
                    type="text"
                    autoComplete="off"
                    placeholder="EXAMPLE-123"
                    className="min-w-0 flex-1 rounded-xl border border-white/15 bg-white px-4 py-3.5 font-bold uppercase tracking-[.12em] text-[#18251f] outline-none ring-[#efb85d] placeholder:font-medium placeholder:tracking-normal placeholder:text-slate-400 focus:ring-3"
                    value={code}
                    onChange={(event) => setCode(event.target.value.toUpperCase())}
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#efb85d] px-5 py-3.5 font-extrabold text-[#2e2719] transition hover:bg-[#f4c97f] disabled:cursor-wait disabled:opacity-60"
                  >
                    {loading ? "Checking…" : "Start course"}
                    {!loading && <ArrowRight size={17} />}
                  </button>
                </div>
                {error && (
                  <p role="alert" className="mt-3 text-sm font-semibold text-[#ffb7a9]">
                    {error}
                  </p>
                )}
              </form>

              <div className="mt-8 grid grid-cols-3 gap-3 border-t border-white/10 pt-6 text-center">
                <div>
                  <p className="text-2xl font-black text-[#efc779]">1–100s</p>
                  <p className="mt-1 text-xs text-white/45">Learners</p>
                </div>
                <div>
                  <p className="text-2xl font-black text-[#efc779]">3</p>
                  <p className="mt-1 text-xs text-white/45">Delivery modes</p>
                </div>
                <div>
                  <p className="text-2xl font-black text-[#efc779]">100%</p>
                  <p className="mt-1 text-xs text-white/45">Customizable</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="solutions" className="bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="grid gap-8 lg:grid-cols-[.8fr_1.2fr] lg:items-end">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#b16c36]">
                Built for your need
              </p>
              <h2 className="mt-4 text-4xl font-black tracking-[-.035em] text-[#183c33] sm:text-5xl">
                If it can be taught, it can become a course.
              </h2>
            </div>
            <p className="max-w-2xl text-lg leading-8 text-[#627068] lg:justify-self-end">
              Start with your existing materials and subject-matter expertise. We
              shape them into clear, engaging learning experiences with activities,
              assessments, and measurable completion.
            </p>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {trainingTypes.map(({ icon: Icon, title, text }, index) => (
              <article
                key={title}
                className="group rounded-3xl border border-[#183c33]/10 bg-[#f8f6f0] p-6 transition hover:-translate-y-1 hover:border-[#356555]/30 hover:shadow-[0_20px_45px_rgba(24,60,51,.1)]"
              >
                <div className="flex items-center justify-between">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#dfece6] text-[#356555]">
                    <Icon size={23} />
                  </span>
                  <span className="text-sm font-black text-[#183c33]/20">0{index + 1}</span>
                </div>
                <h3 className="mt-7 text-xl font-extrabold text-[#183c33]">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-[#627068]">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="delivery" className="bg-[#e6eee8] py-20 sm:py-24">
        <div className="mx-auto grid max-w-7xl gap-14 px-5 sm:px-8 lg:grid-cols-[.9fr_1.1fr] lg:items-center lg:px-10">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#356555]">
              Flexible delivery
            </p>
            <h2 className="mt-4 text-4xl font-black tracking-[-.035em] text-[#183c33] sm:text-5xl">
              Meet your learners where they are.
            </h2>
            <p className="mt-6 max-w-xl text-lg leading-8 text-[#536159]">
              Train one person, one team, or hundreds across locations. Choose the
              format that works—or combine formats into one connected program.
            </p>
          </div>

          <div className="grid gap-4">
            {deliveryOptions.map(({ icon: Icon, label, text }) => (
              <article
                key={label}
                className="flex gap-5 rounded-3xl border border-[#183c33]/10 bg-white/75 p-6 sm:items-center sm:p-7"
              >
                <span className="grid h-13 w-13 shrink-0 place-items-center rounded-2xl bg-[#183c33] text-[#efc779]">
                  <Icon size={24} />
                </span>
                <div>
                  <h3 className="text-xl font-extrabold text-[#183c33]">{label}</h3>
                  <p className="mt-1.5 leading-6 text-[#627068]">{text}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#183c33] py-20 text-white sm:py-24">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-2 lg:items-center lg:px-10">
          <div>
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/10 text-[#efc779]">
              <Palette size={27} />
            </span>
            <p className="mt-7 text-xs font-extrabold uppercase tracking-[.2em] text-[#efc779]">
              Your company. Your course.
            </p>
            <h2 className="mt-4 max-w-xl text-4xl font-black tracking-[-.035em] sm:text-5xl">
              Training that feels like it belongs to your organization.
            </h2>
            <p className="mt-6 max-w-xl text-lg leading-8 text-white/65">
              Courses can be branded with your company identity and tailored to
              your language, standards, examples, and expectations.
            </p>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/[.06] p-7 sm:p-9">
            <p className="flex items-center gap-2 text-sm font-bold text-white/50">
              <Building2 size={17} /> Custom course experience
            </p>
            <div className="mt-7 space-y-4">
              {[
                "Company branding and visual identity",
                "Content shaped around your policies and processes",
                "Knowledge checks and final assessments",
                "Trackable progress and completion records",
                "Printable certificates of completion",
              ].map((item) => (
                <div key={item} className="flex gap-3 rounded-2xl bg-white/[.06] px-4 py-3.5">
                  <Check className="mt-0.5 shrink-0 text-[#efc779]" size={18} strokeWidth={3} />
                  <span className="font-semibold text-white/80">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#efb85d] py-16">
        <div className="mx-auto flex max-w-7xl flex-col gap-7 px-5 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-10">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#6b4715]">
              Learning that leads somewhere
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-[#29251d] sm:text-4xl">
              Every completed course can end with a certificate.
            </h2>
          </div>
          <div className="flex items-center gap-4 rounded-2xl bg-[#f8d99e] px-5 py-4 text-[#473216]">
            <Award size={31} />
            <div>
              <p className="font-extrabold">Certificate of completion</p>
              <p className="text-sm text-[#6b5430]">A clear record of learner achievement</p>
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-[#112a24] text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-10 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-10">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-[#efc779]">
              <GraduationCap size={21} />
            </span>
            <div>
              <p className="font-extrabold">Career Training</p>
              <p className="text-xs text-white/45">Flexible training for every organization</p>
            </div>
          </div>
          <div className="flex items-center gap-6 text-sm font-semibold text-white/55">
            <a href="#solutions" className="hover:text-white">Solutions</a>
            <a href="#delivery" className="hover:text-white">Delivery</a>
            <Link href="/admin/login" className="hover:text-white">Administrator</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
