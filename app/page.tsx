import Link from "next/link";
import { BookOpenCheck, FileText, GraduationCap, Package, PlayCircle, Presentation, Sparkles } from "lucide-react";
import { CourseCodeEntry } from "@/components/CourseCodeEntry";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#07111f] text-white">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8 sm:py-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-400 text-slate-950">
              <GraduationCap size={24} />
            </span>
            <div>
              <p className="text-sm font-bold uppercase tracking-[.18em] text-amber-300">Training Studio</p>
              <h1 className="text-xl font-bold !text-white sm:text-2xl">AI-powered course creation</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/admin/courses/new" className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white/90 hover:bg-white/5">
              New program
            </Link>
            <Link href="/admin/courses/new/classroom" className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white/90 hover:bg-white/5">
              Slides + PPT
            </Link>
            <Link href="/admin/courses/new/scorm" className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white/90 hover:bg-white/5">
              Upload SCORM
            </Link>
            <Link href="/admin/courses/new/video" className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white/90 hover:bg-white/5">
              Video course
            </Link>
          </div>
        </header>

        <CourseCodeEntry />

        <section className="grid flex-1 gap-10 py-16 lg:grid-cols-[1.12fr_.88fr] lg:items-center lg:py-20">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-amber-200">
              <Sparkles size={16} /> Describe it. Generate it. Make it yours.
            </div>
            <h2 className="mt-6 max-w-3xl font-serif text-5xl font-semibold leading-[1.02] tracking-[-.035em] sm:text-6xl">
              Turn your expertise into training people remember.
            </h2>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              Build with AI, upload PowerPoint slides for narration, import SCORM, or link a YouTube video with timed knowledge checks.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/admin/courses/new/ai" className="inline-flex items-center gap-2 rounded-2xl bg-amber-400 px-6 py-3.5 font-bold text-slate-950">
                <Sparkles size={18} /> Create with AI
              </Link>
              <Link href="/admin/courses/new/classroom" className="inline-flex items-center gap-2 rounded-2xl border border-white/15 px-6 py-3.5 font-semibold text-white/90 hover:bg-white/5">
                <Presentation size={18} /> Slides + PPT
              </Link>
              <Link href="/admin/courses/new/scorm" className="inline-flex items-center gap-2 rounded-2xl border border-white/15 px-6 py-3.5 font-semibold text-white/90 hover:bg-white/5">
                <Package size={18} /> Upload SCORM
              </Link>
              <Link href="/admin/courses/new/video" className="inline-flex items-center gap-2 rounded-2xl border border-white/15 px-6 py-3.5 font-semibold text-white/90 hover:bg-white/5">
                <PlayCircle size={18} /> Video course
              </Link>
            <Link href="/training/demo" className="rounded-2xl border border-white/15 px-6 py-3.5 font-semibold text-white/90">
              View learner experience
            </Link>
            <Link href="/canvas" className="inline-flex items-center gap-2 rounded-2xl bg-red-500 px-6 py-3.5 font-bold text-white shadow-lg shadow-red-500/30">
              Canvas alerts
            </Link>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur sm:p-7">
            <div className="rounded-2xl bg-white p-6 text-slate-900">
              <p className="text-xs font-black uppercase tracking-[.16em] text-amber-700">Course request</p>
              <p className="mt-3 text-lg font-semibold leading-7">Create fall-protection training for new commercial roofing employees.</p>
              <div className="mt-5 flex gap-2 text-xs font-semibold text-slate-500">
                <span className="rounded-full bg-slate-100 px-3 py-1.5">30 minutes</span>
                <span className="rounded-full bg-slate-100 px-3 py-1.5">8 questions</span>
              </div>
              <div className="mt-5 flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-600">
                <FileText className="text-amber-700" size={19} /> Fall Protection Policy.pdf
              </div>
            </div>
            <div className="my-4 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-[.16em] text-amber-200">
              <Sparkles size={14} /> AI builds the editable draft
            </div>
            <div className="rounded-2xl bg-[#10283f] p-6">
              <div className="flex items-center gap-3">
                <BookOpenCheck className="text-amber-300" size={24} />
                <div>
                  <p className="font-bold">Fall Protection Fundamentals</p>
                  <p className="mt-1 text-xs text-slate-400">4 chapters · scenarios · final assessment</p>
                </div>
              </div>
              <div className="mt-5 space-y-2">
                {["Recognize fall hazards", "Select protection systems", "Inspect equipment", "Respond to unsafe conditions"].map((item, index) => (
                  <div key={item} className="flex items-center gap-3 rounded-xl bg-white/5 px-4 py-3 text-sm text-slate-200">
                    <span className="text-xs font-black text-amber-300">{String(index + 1).padStart(2, "0")}</span>{item}
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
