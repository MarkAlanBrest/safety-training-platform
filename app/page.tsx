import Link from "next/link";
import { GraduationCap, Presentation, Sparkles } from "lucide-react";
import { demoClassroomCourse } from "@/lib/classroom";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#07111f] text-white">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-10">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-400 text-slate-950">
              <GraduationCap size={24} />
            </span>
            <div>
              <p className="text-sm font-bold uppercase tracking-[.18em] text-amber-300">
                AI Classroom
              </p>
              <h1 className="text-2xl font-bold">Live teaching from your slides</h1>
            </div>
          </div>
          <Link
            href="/admin/classroom/new"
            className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white/90 hover:bg-white/5"
          >
            Upload a PowerPoint
          </Link>
        </header>

        <section className="mt-16 grid gap-8 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-amber-200">
              <Sparkles size={16} />
              Separate from scroll-based training
            </div>
            <h2 className="mt-6 text-4xl font-bold leading-tight sm:text-5xl">
              An AI teacher that talks, listens, and teaches from your deck.
            </h2>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
              Upload a PowerPoint, then enter a three-panel classroom: lesson
              navigation on the left, a live presentation area in the center, and an
              always-on instructor chat on the right.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={`/classroom/${demoClassroomCourse.slug}`}
                className="rounded-2xl bg-amber-400 px-6 py-3 font-bold text-slate-950"
              >
                Try the demo classroom
              </Link>
              <Link
                href="/training/demo"
                className="rounded-2xl border border-white/15 px-6 py-3 font-semibold text-white/90"
              >
                Compare with classic training
              </Link>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur">
            <div className="grid grid-cols-3 gap-3 text-center text-xs font-semibold uppercase tracking-[.14em] text-slate-400">
              <span>Navigate</span>
              <span>Present</span>
              <span>Discuss</span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="rounded-2xl bg-[#0f2b46] p-4 text-left text-sm text-slate-200">
                Lesson topics
              </div>
              <div className="rounded-2xl bg-white p-4 text-left text-sm text-slate-800">
                <Presentation className="mb-3 text-amber-500" size={22} />
                Slides, questions, exercises, and examples
              </div>
              <div className="rounded-2xl bg-[#13243a] p-4 text-left text-sm text-slate-200">
                Dialogue with quick replies like “Raise your hand”
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
