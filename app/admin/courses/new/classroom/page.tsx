"use client";

import Link from "next/link";
import { ArrowLeft, Check, Presentation } from "lucide-react";
import AdminShell from "@/components/AdminShell";
import CourseBuilderForm from "@/components/classroom/builder/CourseBuilderForm";

export default function NewClassroomCoursePage() {
  return (
    <AdminShell title="PowerPoint narration course" eyebrow="Slide images + AI instructor">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/admin/courses"
          className="inline-flex items-center gap-2 text-sm font-bold text-[#69757e] hover:text-[#10283f]"
        >
          <ArrowLeft size={16} /> Back to programs
        </Link>

        <section className="mt-5 overflow-hidden rounded-[2rem] bg-[#10283f] text-white shadow-xl">
          <div className="grid lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,.8fr)]">
            <div className="px-7 py-9 sm:px-10 sm:py-12">
              <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1.5 text-xs font-black uppercase tracking-[.16em] text-amber-200">
                <Presentation size={14} /> PowerPoint + slide images
              </span>
              <h2 className="mt-6 max-w-2xl font-serif text-4xl font-semibold leading-[1.05]">
                Upload your deck and exported slide images for AI narration
              </h2>
              <p className="mt-5 max-w-xl text-base leading-8 text-slate-300">
                Provide the original PowerPoint and a ZIP of exported slide images. The AI instructor
                narrates from speaker notes while learners see your exact slide visuals.
              </p>
            </div>
            <div className="border-t border-white/10 bg-white/5 p-7 lg:border-l lg:border-t-0 lg:p-9">
              <p className="text-xs font-black uppercase tracking-[.16em] text-amber-200">
                You will upload
              </p>
              <div className="mt-5 space-y-4">
                {[
                  "PowerPoint (.pptx) with speaker notes for the AI script",
                  "ZIP of exported slide images (one image per slide)",
                  "Optional extra chapters with their own PPTX + image ZIP",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3 text-sm leading-6 text-slate-200">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-amber-300 text-[#10283f]">
                      <Check size={12} strokeWidth={3} />
                    </span>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="mt-7">
          <CourseBuilderForm />
        </div>
      </div>
    </AdminShell>
  );
}
