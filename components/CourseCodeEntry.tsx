"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

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
    <div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
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
          placeholder="Enter your course code"
          autoComplete="off"
          spellCheck={false}
          className="min-w-0 flex-1 rounded-xl border border-white/15 bg-[#07111f] px-4 py-3.5 font-mono text-sm tracking-wider text-white outline-none placeholder:font-sans placeholder:tracking-normal placeholder:text-slate-500 focus:border-amber-400"
        />
        <button
          type="submit"
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-400 px-6 py-3.5 text-sm font-bold text-slate-950 hover:bg-amber-300"
        >
          Start course
          <ArrowRight size={16} />
        </button>
      </form>
      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
    </div>
  );
}
