import Link from "next/link";
import {
  BookOpenCheck,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Package,
  PlayCircle,
  Presentation,
  Sparkles,
} from "lucide-react";
import { CourseCodeEntry } from "@/components/CourseCodeEntry";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#07111f] text-white">
      <div className="mx-auto max-w-6xl px-6 py-8 sm:py-12">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-400 text-slate-950">
              <GraduationCap size={22} />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[.18em] text-amber-300">
                Training Studio
              </p>
              <p className="text-lg font-bold text-white">AI Classroom</p>
            </div>
          </div>
          <Link
            href="/admin/courses"
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-white/90 hover:bg-white/5"
          >
            <LayoutDashboard size={16} />
            <span className="hidden sm:inline">Course admin</span>
            <span className="sm:hidden">Admin</span>
          </Link>
        </header>

        <section className="mt-14 grid gap-14 lg:mt-20 lg:grid-cols-[1fr_0.92fr] lg:items-start lg:gap-16">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-amber-200">
              <Sparkles size={16} />
              Describe it. Generate it. Make it yours.
            </div>

            <h1 className="mt-6 max-w-xl font-serif text-4xl font-semibold leading-[1.08] tracking-[-.03em] sm:text-5xl lg:text-[3.25rem]">
              Turn your expertise into training people remember.
            </h1>

            <p className="mt-5 max-w-lg text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">
              Build with AI, upload PowerPoint slides for narration, import SCORM, or
              link a YouTube video with timed knowledge checks.
            </p>

            <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.04] p-6 sm:p-7">
              <p className="text-xs font-black uppercase tracking-[.16em] text-amber-300">
                For learners
              </p>
              <h2 className="mt-2 text-xl font-semibold text-white">
                Start or continue your training
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Enter the course code you received from your training administrator.
              </p>
              <div className="mt-5">
                <CourseCodeEntry />
              </div>
            </div>

            <div className="mt-10 border-t border-white/10 pt-10">
              <p className="text-xs font-black uppercase tracking-[.16em] text-slate-500">
                For training teams
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href="/admin/courses/new/ai"
                  className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-amber-300"
                >
                  <Sparkles size={17} />
                  Create with AI
                </Link>
                <Link
                  href="/admin/courses/new/classroom"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold text-white/90 hover:bg-white/5"
                >
                  <Presentation size={17} />
                  Slides + PPT
                </Link>
                <Link
                  href="/admin/courses/new/scorm"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold text-white/90 hover:bg-white/5"
                >
                  <Package size={17} />
                  SCORM
                </Link>
                <Link
                  href="/admin/courses/new/video"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold text-white/90 hover:bg-white/5"
                >
                  <PlayCircle size={17} />
                  Video
                </Link>
              </div>
              <p className="mt-4">
                <Link
                  href="/training/demo"
                  className="text-sm font-semibold text-amber-300 hover:text-amber-200"
                >
                  Preview the learner experience →
                </Link>
              </p>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur sm:p-7 lg:sticky lg:top-10">
            <div className="rounded-2xl bg-white p-6 text-slate-900">
              <p className="text-xs font-black uppercase tracking-[.16em] text-amber-700">
                Course request
              </p>
              <p className="mt-3 text-lg font-semibold leading-7">
                Create fall-protection training for new commercial roofing employees.
              </p>
              <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
                <span className="rounded-full bg-slate-100 px-3 py-1.5">30 minutes</span>
                <span className="rounded-full bg-slate-100 px-3 py-1.5">8 questions</span>
              </div>
              <div className="mt-5 flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-600">
                <FileText className="shrink-0 text-amber-700" size={19} />
                Fall Protection Policy.pdf
              </div>
            </div>

            <div className="my-5 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-[.16em] text-amber-200">
              <Sparkles size={14} />
              AI builds the editable draft
            </div>

            <div className="rounded-2xl bg-[#10283f] p-6">
              <div className="flex items-center gap-3">
                <BookOpenCheck className="shrink-0 text-amber-300" size={24} />
                <div>
                  <p className="font-bold">Fall Protection Fundamentals</p>
                  <p className="mt-1 text-xs text-slate-400">
                    4 chapters · scenarios · final assessment
                  </p>
                </div>
              </div>
              <div className="mt-5 space-y-2">
                {[
                  "Recognize fall hazards",
                  "Select protection systems",
                  "Inspect equipment",
                  "Respond to unsafe conditions",
                ].map((item, index) => (
                  <div
                    key={item}
                    className="flex items-center gap-3 rounded-xl bg-white/5 px-4 py-3 text-sm text-slate-200"
                  >
                    <span className="text-xs font-black text-amber-300">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
