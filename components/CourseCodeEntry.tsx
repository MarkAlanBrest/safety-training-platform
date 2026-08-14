"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, KeyRound } from "lucide-react";

export function CourseCodeEntry() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = code.trim().toUpperCase();
    if (!normalized) {
      setError("Enter your course code.");
      return;
    }
    setError("");
    router.push(`/enroll?code=${encodeURIComponent(normalized)}`);
  }

  return (
    <div className="rounded-2xl border border-amber-400/25 bg-amber-400/10 px-5 py-4 sm:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="flex items-start gap-3 lg:min-w-[220px]">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-400 text-slate-950">
            <KeyRound size={18} />
          </span>
          <div>
            <p className="font-semibold text-white">Have a course code?</p>
            <p className="mt-0.5 text-sm text-slate-300">
              Enter it to start or continue your training.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor="course-code">
            Course code
          </label>
          <input
            id="course-code"
            name="code"
            type="text"
            value={code}
            onChange={(event) => {
              setCode(event.target.value.toUpperCase());
              if (error) setError("");
            }}
            placeholder="Enter course code"
            autoComplete="off"
            spellCheck={false}
            className="min-w-0 flex-1 rounded-xl border border-white/15 bg-[#07111f] px-4 py-3 font-mono text-sm tracking-wider text-white outline-none placeholder:font-sans placeholder:tracking-normal placeholder:text-slate-500 focus:border-amber-400"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-amber-300"
          >
            Start course
            <ArrowRight size={16} />
          </button>
        </form>
      </div>
      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
    </div>
  );
}
