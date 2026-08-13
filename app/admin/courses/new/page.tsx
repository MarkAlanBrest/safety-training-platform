"use client";

import Link from "next/link";
import { ArrowRight, Package, Sparkles } from "lucide-react";
import AdminShell from "@/components/AdminShell";

const creationOptions = [
  {
    href: "/admin/courses/new/ai",
    eyebrow: "AI course studio",
    title: "Create with AI",
    description:
      "Describe what learners need to know and optionally add supporting documents. AI builds a fully editable native course with lessons, activities, and assessments.",
    icon: Sparkles,
    accent: "bg-[#fff3d7] text-[#9a6812]",
    cta: "Start AI builder",
  },
  {
    href: "/admin/courses/new/scorm",
    eyebrow: "SCORM import",
    title: "Upload SCORM package",
    description:
      "Import an existing SCORM 1.2 or 2004 ZIP package. Learners take the packaged course with progress tracking, completion, and optional AI narration.",
    icon: Package,
    accent: "bg-[#e7f2f5] text-[#24546b]",
    cta: "Upload package",
  },
] as const;

export default function NewCoursePage() {
  return (
    <AdminShell title="New training program" eyebrow="Choose a course type">
      <div className="mx-auto max-w-5xl">
        <section className="rounded-3xl border border-[#10283f]/10 bg-white p-8 shadow-sm sm:p-10">
          <h2 className="font-serif text-3xl font-semibold text-[#10283f] sm:text-4xl">
            How would you like to build this program?
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-7 text-[#69757e]">
            Start from scratch with AI, or bring an existing SCORM package from
            Articulate, iSpring, Captivate, or another authoring tool.
          </p>
        </section>

        <div className="mt-7 grid gap-6 lg:grid-cols-2">
          {creationOptions.map((option) => {
            const Icon = option.icon;
            return (
              <Link
                key={option.href}
                href={option.href}
                className="group flex h-full flex-col rounded-3xl border border-[#10283f]/10 bg-white p-7 shadow-sm transition hover:-translate-y-0.5 hover:border-[#c68b1b]/40 hover:shadow-md sm:p-8"
              >
                <span
                  className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-[.14em] ${option.accent}`}
                >
                  <Icon size={14} />
                  {option.eyebrow}
                </span>
                <h3 className="mt-5 font-serif text-2xl font-semibold text-[#10283f]">
                  {option.title}
                </h3>
                <p className="mt-3 flex-1 text-sm leading-7 text-[#69757e]">
                  {option.description}
                </p>
                <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[#10283f] group-hover:text-[#a06e16]">
                  {option.cta} <ArrowRight size={16} />
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </AdminShell>
  );
}
