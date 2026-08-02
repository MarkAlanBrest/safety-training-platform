"use client";

import Link from "next/link";
import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  BookOpen,
  Check,
  Clipboard,
  Clock3,
  FilePlus2,
  KeyRound,
  LoaderCircle,
  ImagePlus,
  Plus,
  RefreshCw,
  Save,
  Settings2,
  Users,
  X,
} from "lucide-react";
import AdminShell from "@/components/AdminShell";
import { courseIntensities, courseThemes } from "@/lib/course-options";

type Section = {
  id: number;
  title: string;
  position: number;
  estimatedMinutes: number;
  fileName: string;
  lessonPlan: { objectives?: string[]; moments?: unknown[] };
};

type EnrollmentCode = {
  id: number;
  code: string;
  batchName: string | null;
  recipientName: string;
  company: string | null;
  status: string;
  expiresAt: string | null;
  createdAt: string;
  claimedAt: string | null;
  enrollment: {
    firstName: string;
    lastName: string;
    email: string;
    progress: number;
    status: string;
  } | null;
};

type Enrollment = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  progress: number;
  enrolledAt: string;
  lastAccessedAt: string;
  completedAt: string | null;
  code: { code: string };
};

type Course = {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  audience: string | null;
  theme: string;
  companyName: string | null;
  logoData: string | null;
  accentColor: string | null;
  displayMode: "webpage" | "slideshow";
  intensity: string;
  estimatedMinutes: number;
  published: boolean;
  updatedAt: string;
  sections: Section[];
  enrollmentCodes: EnrollmentCode[];
  enrollments: Enrollment[];
};

type Tab = "content" | "settings" | "codes" | "learners";

function defaultExpirationInputValue() {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  return date.toISOString().slice(0, 10);
}

export default function CourseEditorPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;
  const [course, setCourse] = useState<Course | null>(null);
  const [tab, setTab] = useState<Tab>("content");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [regeneratingId, setRegeneratingId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [logoData, setLogoData] = useState<string | null>(null);
  const [accentColor, setAccentColor] = useState<string | null>(null);

  async function load() {
    if (!slug) return;
    const response = await fetch(`/api/admin/courses/${slug}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Course could not be loaded.");
    setCourse(data);
    setLogoData(data.logoData || null);
    setAccentColor(data.accentColor || null);
  }

  useEffect(() => {
    load()
      .catch((caught) =>
        setError(caught instanceof Error ? caught.message : "Course could not be loaded."),
      )
      .finally(() => setLoading(false));
    // The route slug is the stable identity for this editor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const metrics = useMemo(() => {
    if (!course) return { available: 0, claimed: 0 };
    return {
      available: course.enrollmentCodes.filter((code) => code.status === "available").length,
      claimed: course.enrollmentCodes.filter((code) => code.status === "claimed").length,
    };
  }, [course]);

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!course) return;
    setBusy(true);
    setError("");
    setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/admin/courses/${course.slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.get("title"),
        description: form.get("description"),
        audience: form.get("audience"),
        estimatedMinutes: form.get("estimatedMinutes"),
        theme: form.get("theme"),
        companyName: form.get("companyName"),
        logoData: form.get("logoData"),
        accentColor: form.get("accentColor"),
        displayMode: form.get("displayMode"),
        intensity: form.get("intensity"),
        published: form.get("published") === "on",
      }),
    });
    const data = await response.json();
    if (!response.ok) setError(data.error || "Changes could not be saved.");
    else {
      await load();
      setMessage("Program settings saved.");
    }
    setBusy(false);
  }

  async function addSection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!course) return;
    setBusy(true);
    setError("");
    setMessage("");
    const form = event.currentTarget;
    const response = await fetch(`/api/admin/courses/${course.slug}/sections`, {
      method: "POST",
      body: new FormData(form),
    });
    const data = await response.json();
    if (!response.ok) setError(data.error || "The section could not be created.");
    else {
      form.reset();
      await load();
      setMessage("Section created from the PDF.");
    }
    setBusy(false);
  }

  async function generateCodes(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!course) return;
    setBusy(true);
    setError("");
    setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/admin/courses/${course.slug}/codes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quantity: form.get("quantity"),
        recipientName: form.get("recipientName"),
        company: form.get("company"),
        expiresAt: form.get("expiresAt"),
      }),
    });
    const data = await response.json();
    if (!response.ok) setError(data.error || "Codes could not be generated.");
    else {
      await load();
      setMessage(`${data.codes.length} enrollment code${data.codes.length === 1 ? "" : "s"} generated.`);
    }
    setBusy(false);
  }

  async function regenerateSection(sectionId: number, pdf: File) {
    if (!course) return;
    setRegeneratingId(sectionId);
    setError("");
    setMessage("");
    const form = new FormData();
    form.set("pdf", pdf);
    const response = await fetch(
      `/api/admin/courses/${course.slug}/sections/${sectionId}/regenerate`,
      { method: "POST", body: form },
    );
    const data = await response.json();
    if (!response.ok) setError(data.error || "The section could not be regenerated.");
    else {
      await load();
      setMessage("Section rebuilt as a continuous webpage from the source PDF.");
    }
    setRegeneratingId(null);
  }

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#edf1f2]">
        <LoaderCircle className="animate-spin text-[#a06e16]" size={32} />
      </main>
    );
  }

  if (!course) {
    return <main className="p-10 text-red-700">{error || "Course not found."}</main>;
  }

  const tabs: Array<{ id: Tab; label: string; icon: typeof BookOpen; count?: number }> = [
    { id: "content", label: "Content", icon: BookOpen, count: course.sections.length },
    { id: "settings", label: "Program settings", icon: Settings2 },
    { id: "codes", label: "Enrollment codes", icon: KeyRound, count: metrics.available },
    { id: "learners", label: "Learners", icon: Users, count: course.enrollments.length },
  ];

  return (
    <AdminShell
      title={course.title}
      eyebrow={course.published ? "Published program" : "Draft program"}
      actions={
        <a
          href={`/training/${course.slug}?preview=${encodeURIComponent(course.updatedAt)}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-xl border border-[#10283f]/15 bg-white px-4 py-3 text-sm font-bold text-[#10283f]"
        >
          Preview course
        </a>
      }
    >
      <div className="mb-7 flex flex-wrap gap-2 rounded-2xl bg-white p-2 shadow-sm ring-1 ring-[#10283f]/10">
        {tabs.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => {
                setTab(item.id);
                setMessage("");
                setError("");
              }}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
                tab === item.id
                  ? "bg-[#10283f] text-white"
                  : "text-[#5d6973] hover:bg-[#edf1f2]"
              }`}
            >
              <Icon size={17} />
              {item.label}
              {item.count !== undefined && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] ${
                    tab === item.id ? "bg-white/15" : "bg-[#e5e9ea]"
                  }`}
                >
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {(message || error) && (
        <div
          className={`mb-6 rounded-xl border p-4 text-sm font-semibold ${
            error
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {error || message}
        </div>
      )}

      {tab === "content" && (
        <div className="grid gap-7 xl:grid-cols-[1fr_380px]">
          <section>
            <div className="mb-5 flex items-end justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[.17em] text-[#9a6812]">
                  Program structure
                </p>
                <h2 className="mt-1 font-serif text-3xl font-semibold text-[#10283f]">
                  Sections and source material
                </h2>
              </div>
              <p className="text-sm font-semibold text-[#6e7981]">
                {course.sections.reduce((total, item) => total + item.estimatedMinutes, 0)} minutes
              </p>
            </div>

            {course.sections.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-[#10283f]/20 bg-white p-10 text-center">
                <FilePlus2 className="mx-auto text-[#d09a31]" size={38} />
                <h3 className="mt-4 text-xl font-bold text-[#10283f]">Add the first section</h3>
                <p className="mt-2 text-sm text-[#6c7881]">
                  Each section begins with a source PDF. The AI creates a structured draft
                  that you can review.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {course.sections.map((section) => (
                  <article
                    key={section.id}
                    className="grid gap-4 rounded-2xl border border-[#10283f]/10 bg-white p-5 shadow-sm sm:grid-cols-[56px_1fr_auto] sm:items-center"
                  >
                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#10283f] font-serif text-xl text-white">
                      {section.position}
                    </span>
                    <div>
                      <h3 className="font-bold text-[#10283f]">{section.title}</h3>
                      <p className="mt-1 text-xs text-[#7b858c]">{section.fileName}</p>
                      <p className="mt-2 text-xs font-semibold text-[#5d6973]">
                        {section.lessonPlan?.objectives?.length || 0} objectives ·{" "}
                        {section.lessonPlan?.moments?.length || 0} generated teaching moments
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-3">
                      <span className="flex items-center gap-1.5 text-xs font-bold text-[#6e7981]">
                        <Clock3 size={14} /> {section.estimatedMinutes} min
                      </span>
                      <label
                        className={`inline-flex items-center gap-2 rounded-lg border border-[#10283f]/15 px-3 py-2 text-xs font-bold text-[#10283f] transition hover:bg-[#edf1f2] ${
                          regeneratingId !== null ? "pointer-events-none opacity-50" : "cursor-pointer"
                        }`}
                      >
                        <RefreshCw
                          size={14}
                          className={regeneratingId === section.id ? "animate-spin" : ""}
                        />
                        {regeneratingId === section.id ? "Rebuilding…" : "Rebuild with new PDF"}
                        <input
                          type="file"
                          accept="application/pdf"
                          className="sr-only"
                          disabled={regeneratingId !== null}
                          onChange={(event) => {
                            const pdf = event.target.files?.[0];
                            if (pdf) regenerateSection(section.id, pdf);
                            event.target.value = "";
                          }}
                        />
                      </label>
                      <Link
                        href={`/admin/courses/${course.slug}/sections/${section.id}`}
                        className="inline-flex items-center gap-2 rounded-lg bg-[#10283f] px-3 py-2 text-xs font-bold text-white"
                      >
                        Edit content
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <aside>
            <form
              onSubmit={addSection}
              className="sticky top-6 space-y-4 rounded-3xl bg-[#10283f] p-6 text-white shadow-xl"
            >
              <div>
                <p className="text-xs font-black uppercase tracking-[.17em] text-[#f2c568]">
                  Add content
                </p>
                <h2 className="mt-2 text-xl font-bold">Create a section from PDF</h2>
                <p className="mt-2 text-xs leading-5 text-slate-300">
                  The PDF is used once to create the page, then discarded. The generated
                  lesson becomes the saved course content.
                </p>
              </div>
              <input
                name="sectionTitle"
                required
                placeholder="Section title"
                className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 outline-none focus:border-[#f2b744]"
              />
              <label className="block">
                <span className="mb-2 block text-xs font-bold text-slate-300">Estimated minutes</span>
                <input
                  name="estimatedMinutes"
                  type="number"
                  min={5}
                  defaultValue={20}
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 outline-none"
                />
              </label>
              <label className="block rounded-2xl border-2 border-dashed border-white/20 p-5 text-center">
                <FilePlus2 className="mx-auto mb-2 text-[#f2c568]" />
                <span className="block text-sm font-bold">Choose source PDF</span>
                <span className="mb-3 block text-xs text-slate-400">Up to 25 MB</span>
                <input name="pdf" type="file" accept="application/pdf" required className="text-xs" />
              </label>
              <button
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#f2b744] px-4 py-3 font-bold text-[#10283f] disabled:opacity-60"
              >
                {busy ? <LoaderCircle className="animate-spin" size={18} /> : <Plus size={18} />}
                {busy ? "Building section…" : "Add section"}
              </button>
            </form>
          </aside>
        </div>
      )}

      {tab === "settings" && (
        <form onSubmit={saveSettings} className="grid gap-7 xl:grid-cols-[1fr_.8fr]">
          <section className="space-y-5 rounded-3xl border border-[#10283f]/10 bg-white p-7">
            <h2 className="font-serif text-2xl font-semibold text-[#10283f]">Program details</h2>
            <label className="block">
              <span className="mb-2 block text-sm font-bold">Title</span>
              <input name="title" required defaultValue={course.title} className="w-full rounded-xl border border-[#10283f]/15 px-4 py-3" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold">Description</span>
              <textarea name="description" rows={4} defaultValue={course.description || ""} className="w-full resize-none rounded-xl border border-[#10283f]/15 px-4 py-3 leading-6" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold">Audience</span>
              <input name="audience" defaultValue={course.audience || ""} className="w-full rounded-xl border border-[#10283f]/15 px-4 py-3" />
            </label>
            <label className="block max-w-xs">
              <span className="mb-2 block text-sm font-bold">Estimated total minutes</span>
              <input name="estimatedMinutes" type="number" min={10} defaultValue={course.estimatedMinutes} className="w-full rounded-xl border border-[#10283f]/15 px-4 py-3" />
            </label>
          </section>

          <aside className="space-y-6">
            <section className="rounded-3xl border border-[#10283f]/10 bg-white p-6">
              <p className="text-xs font-black uppercase tracking-[.17em] text-[#9a6812]">
                Course format
              </p>
              <p className="mt-2 text-sm leading-6 text-[#6c7881]">
                Change how the same course content is presented to learners.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {[
                  {
                    id: "webpage",
                    name: "Webpage",
                    description: "A continuous editorial lesson with activities embedded in the reading.",
                  },
                  {
                    id: "slideshow",
                    name: "Slideshow",
                    description: "One topic or activity at a time with Previous and Next controls.",
                  },
                ].map((option) => (
                  <label key={option.id} className="cursor-pointer">
                    <input
                      type="radio"
                      name="displayMode"
                      value={option.id}
                      defaultChecked={(course.displayMode || "webpage") === option.id}
                      className="peer sr-only"
                    />
                    <span className="block h-full rounded-2xl border border-[#10283f]/10 p-4 peer-checked:border-[#c68b1b] peer-checked:bg-[#fff9eb] peer-checked:ring-2 peer-checked:ring-[#e8c273]/25">
                      <span className="font-bold text-[#10283f]">{option.name}</span>
                      <span className="mt-2 block text-xs leading-5 text-[#6c7881]">
                        {option.description}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-[#10283f]/10 bg-white p-6">
              <p className="text-xs font-black uppercase tracking-[.17em] text-[#9a6812]">
                Company branding
              </p>
              <div className="mt-5 space-y-5">
                <label className="block">
                  <span className="mb-2 block text-sm font-bold">Company name</span>
                  <input
                    name="companyName"
                    defaultValue={course.companyName || ""}
                    placeholder="Shown above the course title"
                    maxLength={120}
                    className="w-full rounded-xl border border-[#10283f]/15 px-4 py-3"
                  />
                </label>

                <div>
                  <span className="mb-2 block text-sm font-bold">Company logo</span>
                  <input type="hidden" name="logoData" value={logoData || ""} />
                  {logoData ? (
                    <div className="flex items-center gap-4 rounded-2xl border border-[#10283f]/10 bg-[#f5f7f7] p-4">
                      <span className="flex h-20 flex-1 items-center justify-center rounded-xl bg-white p-3">
                        <Image
                          src={logoData}
                          alt="Company logo preview"
                          width={240}
                          height={80}
                          unoptimized
                          className="max-h-14 w-auto max-w-full object-contain"
                        />
                      </span>
                      <button
                        type="button"
                        onClick={() => setLogoData(null)}
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-red-200 bg-white text-red-700"
                        aria-label="Remove company logo"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  ) : (
                    <label className="flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-dashed border-[#10283f]/15 p-5 text-sm font-bold text-[#53616b] hover:border-[#c68b1b]">
                      <ImagePlus className="text-[#b47a13]" size={22} />
                      Upload PNG, JPEG, or WebP
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="sr-only"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (!file) return;
                          if (file.size > 1_000_000) {
                            setError("The company logo must be under 1 MB.");
                            event.target.value = "";
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = () => {
                            setLogoData(String(reader.result));
                            setError("");
                          };
                          reader.readAsDataURL(file);
                        }}
                      />
                    </label>
                  )}
                  <p className="mt-2 text-xs leading-5 text-[#78838a]">
                    A wide logo with a transparent background works best. Maximum 1 MB.
                  </p>
                </div>

                <label className="block">
                  <span className="mb-2 block text-sm font-bold">Accent color</span>
                  <span className="flex items-center gap-3">
                    <input type="hidden" name="accentColor" value={accentColor || ""} />
                    <input
                      type="color"
                      value={
                        accentColor ||
                        courseThemes.find((option) => option.id === course.theme)?.colors[2] ||
                        "#d9a036"
                      }
                      onChange={(event) => setAccentColor(event.target.value)}
                      className="h-12 w-16 cursor-pointer rounded-xl border border-[#10283f]/15 bg-white p-1"
                    />
                    <span className="flex-1 text-xs leading-5 text-[#78838a]">
                      Used for highlights, progress, and key actions.
                    </span>
                    {accentColor && (
                      <button
                        type="button"
                        onClick={() => setAccentColor(null)}
                        className="text-xs font-bold text-[#53616b] underline"
                      >
                        Use theme color
                      </button>
                    )}
                  </span>
                </label>
              </div>
            </section>

            <section className="rounded-3xl border border-[#10283f]/10 bg-white p-6">
              <p className="text-xs font-black uppercase tracking-[.17em] text-[#9a6812]">Theme</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {courseThemes.map((option) => (
                  <label key={option.id} className="cursor-pointer">
                    <input type="radio" name="theme" value={option.id} defaultChecked={course.theme === option.id} className="peer sr-only" />
                    <span className="block rounded-2xl border border-[#10283f]/10 p-4 peer-checked:border-[#c68b1b] peer-checked:bg-[#fff9eb] peer-checked:ring-2 peer-checked:ring-[#e8c273]/25">
                      <span className="flex overflow-hidden rounded-full">
                        {option.colors.map((color) => <span key={color} className="h-5 flex-1" style={{ background: color }} />)}
                      </span>
                      <span className="mt-3 block font-bold">{option.name}</span>
                    </span>
                  </label>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-[#10283f]/10 bg-white p-6">
              <p className="text-xs font-black uppercase tracking-[.17em] text-[#9a6812]">Intensity</p>
              <div className="mt-4 space-y-2">
                {courseIntensities.map((option) => (
                  <label key={option.id} className="block cursor-pointer">
                    <input type="radio" name="intensity" value={option.id} defaultChecked={course.intensity === option.id} className="peer sr-only" />
                    <span className="flex items-center justify-between rounded-xl border border-[#10283f]/10 p-3 font-bold peer-checked:border-[#10283f] peer-checked:bg-[#10283f] peer-checked:text-white">
                      {option.name} <Check size={16} />
                    </span>
                  </label>
                ))}
              </div>
            </section>

            <label className="flex items-start gap-3 rounded-2xl border border-[#10283f]/10 bg-white p-5">
              <input name="published" type="checkbox" defaultChecked={course.published} disabled={course.sections.length === 0} className="mt-1 h-4 w-4" />
              <span>
                <span className="block font-bold text-[#10283f]">Published and available for enrollment</span>
                <span className="mt-1 block text-xs leading-5 text-[#6c7881]">
                  {course.sections.length === 0 ? "Add at least one section before publishing." : "Learners with valid codes can enter this program."}
                </span>
              </span>
            </label>

            <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#10283f] px-5 py-4 font-bold text-white">
              {busy ? <LoaderCircle className="animate-spin" size={18} /> : <Save size={18} />}
              Save program settings
            </button>
          </aside>
        </form>
      )}

      {tab === "codes" && (
        <div className="grid gap-7 xl:grid-cols-[360px_1fr]">
          <form onSubmit={generateCodes} className="space-y-5 rounded-3xl bg-[#10283f] p-6 text-white shadow-xl">
            <div>
              <KeyRound className="text-[#f2c568]" size={28} />
              <h2 className="mt-4 text-xl font-bold">Generate enrollment codes</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Each code can be claimed by one learner and then becomes their return-access code.
              </p>
            </div>
            <label className="block">
              <span className="mb-2 block text-xs font-bold text-slate-300">Number of codes</span>
              <input name="quantity" type="number" min={1} max={100} defaultValue={1} className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3" />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-bold text-slate-300">Recipient name</span>
              <input name="recipientName" required placeholder="Jane Smith" className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3" />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-bold text-slate-300">Company (optional)</span>
              <input name="company" placeholder="Acme Fabrication" className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3" />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-bold text-slate-300">Expiration date</span>
              <input
                name="expiresAt"
                type="date"
                defaultValue={defaultExpirationInputValue()}
                className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3"
              />
            </label>
            <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#f2b744] px-4 py-3 font-bold text-[#10283f]">
              {busy ? <LoaderCircle className="animate-spin" size={18} /> : <Plus size={18} />}
              Generate codes
            </button>
          </form>

          <section className="rounded-3xl border border-[#10283f]/10 bg-white p-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[.17em] text-[#9a6812]">Code inventory</p>
                <h2 className="mt-1 font-serif text-2xl font-semibold text-[#10283f]">
                  {metrics.available} available · {metrics.claimed} claimed
                </h2>
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(course.enrollmentCodes.filter((item) => item.status === "available").map((item) => item.code).join("\n"))}
                className="flex items-center gap-2 rounded-xl border border-[#10283f]/15 px-4 py-2 text-sm font-bold"
              >
                <Clipboard size={16} /> Copy available codes
              </button>
            </div>
            <div className="mt-6 max-h-[620px] overflow-auto rounded-2xl border border-[#10283f]/10">
              <table className="w-full min-w-[650px] text-left text-sm">
                <thead className="sticky top-0 bg-[#f0f3f4] text-xs uppercase tracking-wider text-[#65717a]">
                  <tr>
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">Recipient</th>
                    <th className="px-4 py-3">Company</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Learner</th>
                    <th className="px-4 py-3">Expires</th>
                  </tr>
                </thead>
                <tbody>
                  {course.enrollmentCodes.map((item) => (
                    <tr key={item.id} className="border-t border-[#10283f]/10">
                      <td className="px-4 py-3 font-mono font-bold text-[#10283f]">{item.code}</td>
                      <td className="px-4 py-3 text-[#65717a]">{item.recipientName}</td>
                      <td className="px-4 py-3 text-[#65717a]">{item.company || "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${item.status === "available" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#65717a]">
                        {item.enrollment ? `${item.enrollment.firstName} ${item.enrollment.lastName}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-[#65717a]">
                        {item.expiresAt ? new Date(item.expiresAt).toLocaleDateString() : "No expiration"}
                      </td>
                    </tr>
                  ))}
                  {course.enrollmentCodes.length === 0 && (
                    <tr><td colSpan={6} className="px-5 py-10 text-center text-[#7b858c]">No codes generated yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {tab === "learners" && (
        <section className="rounded-3xl border border-[#10283f]/10 bg-white p-6">
          <div>
            <p className="text-xs font-black uppercase tracking-[.17em] text-[#9a6812]">Course roster</p>
            <h2 className="mt-1 font-serif text-2xl font-semibold text-[#10283f]">
              {course.enrollments.length} enrolled learner{course.enrollments.length === 1 ? "" : "s"}
            </h2>
          </div>
          <div className="mt-6 overflow-auto rounded-2xl border border-[#10283f]/10">
            <table className="w-full min-w-[750px] text-left text-sm">
              <thead className="bg-[#f0f3f4] text-xs uppercase tracking-wider text-[#65717a]">
                <tr>
                  <th className="px-4 py-3">Learner</th>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Progress</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Enrolled</th>
                  <th className="px-4 py-3">Last active</th>
                </tr>
              </thead>
              <tbody>
                {course.enrollments.map((learner) => (
                  <tr key={learner.id} className="border-t border-[#10283f]/10">
                    <td className="px-4 py-3">
                      <p className="font-bold text-[#10283f]">{learner.firstName} {learner.lastName}</p>
                      <p className="text-xs text-[#7b858c]">{learner.email}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{learner.code.code}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="h-2 w-24 overflow-hidden rounded-full bg-[#e2e7e8]">
                          <span className="block h-full bg-[#d9a036]" style={{ width: `${learner.progress}%` }} />
                        </span>
                        <span className="font-bold">{learner.progress}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 capitalize">{learner.status}</td>
                    <td className="px-4 py-3 text-[#65717a]">{new Date(learner.enrolledAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-[#65717a]">{new Date(learner.lastAccessedAt).toLocaleDateString()}</td>
                  </tr>
                ))}
                {course.enrollments.length === 0 && (
                  <tr><td colSpan={6} className="px-5 py-12 text-center text-[#7b858c]">No learners have claimed a code yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </AdminShell>
  );
}
