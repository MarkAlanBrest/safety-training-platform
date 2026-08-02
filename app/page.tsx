"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Clock,
  KeyRound,
  MapPin,
  Phone,
} from "lucide-react";

const programs = [
  { name: "Automotive Technology", href: "https://www.ncstrades.edu/new-castle-programs/automotive-technology/" },
  { name: "Building Technology", href: "https://www.ncstrades.edu/new-castle-programs/building-technology/" },
  { name: "Combination Welding", href: "https://www.ncstrades.edu/new-castle-programs/combination-welding/" },
  { name: "Electrical Technology", href: "https://www.ncstrades.edu/new-castle-programs/electrical-technology/" },
  { name: "Industrial Electro-Mechanical Technology", href: "https://www.ncstrades.edu/new-castle-programs/industrial-electro-mechanical-technology/" },
  { name: "Machinist & CNC Manufacturing", href: "https://www.ncstrades.edu/new-castle-programs/high-quality-cnc-machine-training/" },
  { name: "Refrigeration & A/C Technology", href: "https://www.ncstrades.edu/new-castle-programs/refrigeration-ac-technology/" },
];

const facilityFeatures = [
  "Administrative offices",
  "Career Services Offices",
  "Admissions and Financial Aid Offices",
  "Student cafeteria",
  "Break areas",
  "Free parking",
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
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-8 gap-y-2 px-4 py-2 text-sm font-bold sm:px-6">
          <span className="flex items-center gap-2">
            <MapPin size={15} className="shrink-0" />
            4117 Pulaski Rd, New Castle, PA 16101
          </span>
          <a
            href="tel:7249648811"
            className="flex items-center gap-2 hover:underline"
          >
            <Phone size={15} className="shrink-0" />
            (724) 964-8811
          </a>
          <span className="hidden items-center gap-2 md:flex">
            <Clock size={15} className="shrink-0" />
            Mon–Thurs 8am–8pm · Fri 8am–4pm · Sat 9am–1pm
          </span>
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
              href="https://www.ncstrades.edu/new-castle-programs/"
              className="font-[family-name:var(--font-oswald)] text-sm font-medium uppercase tracking-wide text-white hover:text-[#faa200]"
            >
              Programs
            </a>
            <a
              href="https://www.ncstrades.edu/admissions/"
              className="font-[family-name:var(--font-oswald)] text-sm font-medium uppercase tracking-wide text-white hover:text-[#faa200]"
            >
              Admissions
            </a>
            <a
              href="https://www.ncstrades.edu/job-placement/"
              className="font-[family-name:var(--font-oswald)] text-sm font-medium uppercase tracking-wide text-white hover:text-[#faa200]"
            >
              Job Placement
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

      {/* Hero banner */}
      <section className="relative h-[220px] overflow-hidden sm:h-[280px] md:h-[310px]">
        <Image
          src="/images/ncst-campus-hero.jpg"
          alt="NCST New Castle, PA campus exterior"
          fill
          className="object-cover object-center"
          priority
        />
        <div className="absolute inset-0 bg-[#002d74]/30" />
      </section>

      {/* Location info bar */}
      <div className="relative z-10 mx-auto -mt-10 max-w-5xl px-4 sm:px-6">
        <ul className="flex flex-col divide-y divide-[#002d74]/20 overflow-hidden rounded-sm bg-white shadow-[0_5px_15px_rgba(0,0,0,0.15)] sm:flex-row sm:divide-x sm:divide-y-0">
          <li className="flex flex-1 items-center gap-3 px-5 py-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center bg-[#faa200] text-[#002d74]">
              <MapPin size={18} />
            </span>
            <span className="text-sm font-bold leading-snug text-[#002d74]">
              4117 Pulaski Rd,
              <br />
              New Castle, PA, 16101
            </span>
          </li>
          <li className="flex flex-1 items-center justify-center gap-3 px-5 py-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center bg-[#faa200] text-[#002d74]">
              <Phone size={18} />
            </span>
            <a
              href="tel:7249648811"
              className="font-[family-name:var(--font-oswald)] text-xl font-medium text-[#002d74] hover:text-[#faa200]"
            >
              (724) 964-8811
            </a>
          </li>
          <li className="flex flex-1 items-center gap-3 px-5 py-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center bg-[#faa200] text-[#002d74]">
              <Clock size={18} />
            </span>
            <span className="text-sm font-bold leading-snug text-[#002d74]">
              Mon – Thurs | 8:00 am – 8:00 pm
              <br />
              Friday | 8:00 am – 4:00 pm
              <br />
              Saturday | 9:00 am – 1:00 pm
            </span>
          </li>
        </ul>
      </div>

      {/* Map + learner access form */}
      <section id="learner-access" className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="grid gap-0 lg:grid-cols-2">
          <div className="relative min-h-[320px] overflow-hidden bg-[#f2f2f2] lg:min-h-[480px]">
            <iframe
              title="NCST New Castle Campus Map"
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3010.5!2d-80.32!3d41.02!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x88336f8c8c8c8c8d%3A0x0!2s4117%20Pulaski%20Rd%2C%20New%20Castle%2C%20PA%2016101!5e0!3m2!1sen!2sus!4v1"
              className="absolute inset-0 h-full w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>

          <div className="bg-[#002d74] p-8 sm:p-10 lg:p-12">
            <h3 className="font-[family-name:var(--font-oswald)] text-2xl font-medium uppercase tracking-wide text-[#faa200]">
              Learner Access
            </h3>
            <p className="mt-2 flex items-center gap-2 text-sm text-white/70">
              <KeyRound size={15} />
              Enter your course code to begin training
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              <div>
                <label
                  htmlFor="course-code"
                  className="block text-sm font-bold uppercase tracking-wide text-white/80"
                >
                  Course Code *
                </label>
                <input
                  id="course-code"
                  type="text"
                  autoComplete="off"
                  placeholder="EXAMPLE-123"
                  className="mt-2 w-full border-2 border-[#b1b4ba] bg-white px-4 py-3 font-bold uppercase tracking-wider text-[#111] outline-none focus:border-[#faa200]"
                  value={code}
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="ncst-btn ncst-btn-orange flex w-full items-center justify-center gap-2 disabled:cursor-wait disabled:opacity-60"
              >
                {loading ? "Checking…" : "Start Course"}
                {!loading && <ArrowRight size={17} />}
              </button>

              {error && (
                <p role="alert" className="text-sm font-semibold text-[#ed1c24]">
                  {error}
                </p>
              )}
            </form>

            <p className="mt-6 text-sm leading-6 text-white/55">
              Use the course code provided by your instructor or training
              administrator. If you need help, contact the campus at{" "}
              <a href="tel:7249648811" className="text-[#faa200] hover:underline">
                (724) 964-8811
              </a>
              .
            </p>
          </div>
        </div>
      </section>

      {/* Campus content + programs */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
        <div className="grid gap-0 lg:grid-cols-2">
          <div className="bg-white p-8 shadow-[0_5px_15px_rgba(0,0,0,0.15)] sm:p-10">
            <h1 className="font-[family-name:var(--font-oswald)] text-3xl font-medium text-[#002d74] sm:text-4xl">
              NCST New Castle, PA Campus
            </h1>

            <div className="mt-6 space-y-4 text-base leading-7 text-[#404040]">
              <p>
                The New Castle, PA Campus is the main facility for New Castle
                School of Trades. The school is located at{" "}
                <a
                  href="https://g.page/new-castle-school-of-trades?share"
                  className="font-bold text-[#002d74] underline hover:text-[#faa200]"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  4117 Pulaski Rd New Castle, Pennsylvania, 16101
                </a>
                ; only seven miles east of the Ohio-Pennsylvania border. This
                facility held its grand opening in July 2011 and provides an
                impressive 93,000 square feet of space, every inch of it
                dedicated to instruction in the skilled trades.
              </p>
              <p>
                The school is divided into specific shops, classrooms, labs, and
                office areas. There are 12 classrooms, one computer lab, library,
                and each program has its own shop/lab area equipped with tools
                and equipment.
              </p>
              <p>
                The main building is home to 7 out of 11 programs offered at NCST
                and is divided into specific areas for shops, classrooms, labs,
                and offices. The programs offered here are:
              </p>

              <ul className="list-disc space-y-1 pl-5">
                {programs.map((program) => (
                  <li key={program.name}>
                    <a
                      href={program.href}
                      className="font-bold text-[#002d74] hover:text-[#faa200]"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {program.name}
                    </a>
                  </li>
                ))}
              </ul>

              <p>The main facility also includes:</p>
              <ul className="list-disc space-y-1 pl-5">
                {facilityFeatures.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex flex-col justify-center bg-[#002d74] p-8 text-center sm:p-10">
            <h3 className="font-[family-name:var(--font-oswald)] text-2xl font-medium text-white">
              Programs provided at the New Castle, PA Campus
            </h3>
            <ul className="mt-6 space-y-3">
              {programs.map((program) => (
                <li key={program.name}>
                  <a
                    href={program.href}
                    className="ncst-btn block w-full border-white text-white hover:border-[#faa200] hover:bg-[#faa200] hover:text-[#002d74]"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {program.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Footer CTA bar */}
      <section className="bg-[#faa200] py-6">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-center gap-4 px-4 sm:flex-row sm:gap-8 sm:px-6">
          <a
            href="https://www.ncstrades.edu/admissions/"
            className="ncst-btn w-full max-w-xs border-[#002d74] text-center text-[#002d74] hover:bg-[#002d74] hover:text-white sm:w-auto"
            target="_blank"
            rel="noopener noreferrer"
          >
            Request Information
          </a>
          <a
            href="tel:7249648811"
            className="ncst-btn w-full max-w-xs border-[#002d74] text-center text-[#002d74] hover:bg-[#002d74] hover:text-white sm:w-auto"
          >
            Call (724) 964-8811
          </a>
          <a
            href="#learner-access"
            className="ncst-btn ncst-btn-filled w-full max-w-xs border-[#002d74] text-center sm:w-auto"
          >
            Start a Course
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#002d74] text-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
          <h4 className="mb-6 text-center font-[family-name:var(--font-oswald)] text-xl font-medium uppercase tracking-wide">
            New Castle School of Trades
          </h4>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="mb-3 font-[family-name:var(--font-oswald)] text-sm font-medium uppercase tracking-wide text-[#faa200]">
                Quick Links
              </p>
              <ul className="space-y-2 text-sm">
                {[
                  { label: "About Us", href: "https://www.ncstrades.edu/about-us/" },
                  { label: "New Castle Programs", href: "https://www.ncstrades.edu/new-castle-programs/" },
                  { label: "East Liverpool Programs", href: "https://www.ncstrades.edu/east-liverpool-programs/" },
                  { label: "Admissions", href: "https://www.ncstrades.edu/admissions/" },
                  { label: "Job Placement", href: "https://www.ncstrades.edu/job-placement/" },
                  { label: "Contact Us", href: "https://www.ncstrades.edu/contact-us/" },
                ].map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-white/80 hover:text-[#faa200]"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="mb-3 font-[family-name:var(--font-oswald)] text-sm font-medium uppercase tracking-wide text-[#faa200]">
                New Castle Campus
              </p>
              <address className="space-y-2 text-sm not-italic text-white/80">
                <p>4117 Pulaski Rd</p>
                <p>New Castle, PA 16101</p>
                <p>
                  <a href="tel:7249648811" className="hover:text-[#faa200]">
                    (724) 964-8811
                  </a>
                </p>
              </address>
            </div>

            <div>
              <p className="mb-3 font-[family-name:var(--font-oswald)] text-sm font-medium uppercase tracking-wide text-[#faa200]">
                Training Platform
              </p>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="#learner-access" className="text-white/80 hover:text-[#faa200]">
                    Learner Access
                  </a>
                </li>
                <li>
                  <Link href="/admin/login" className="text-white/80 hover:text-[#faa200]">
                    Administrator Login
                  </Link>
                </li>
                <li>
                  <a
                    href="https://www.ncstrades.edu/consumer-information/"
                    className="text-white/80 hover:text-[#faa200]"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Consumer Information
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="border-t border-[#0c3485] py-6 text-center text-sm text-white/60">
          <p>
            &copy; {new Date().getFullYear()} New Castle School of Trades. All
            rights reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}
