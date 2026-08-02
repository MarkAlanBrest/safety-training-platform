"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";

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
    <main className="flex min-h-screen flex-col bg-[#f2f2f2] text-[#404040]">
      <header className="bg-[#002d74] px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <Link href="/">
            <Image
              src="/images/ncst-logo.png"
              alt="New Castle School of Trades"
              width={180}
              height={54}
              className="h-11 w-auto sm:h-12"
              priority
            />
          </Link>
          <Link
            href="/admin/login"
            className="font-[family-name:var(--font-oswald)] text-sm font-medium uppercase tracking-wide text-[#faa200] hover:underline"
          >
            Admin login
          </Link>
        </div>
      </header>

      <div className="flex flex-1 items-center px-4 py-12 sm:px-6">
        <div className="mx-auto w-full max-w-3xl">
          <div className="bg-white p-8 shadow-[0_5px_15px_rgba(0,0,0,0.1)] sm:p-10">
            <h1 className="font-[family-name:var(--font-oswald)] text-3xl font-medium uppercase text-[#002d74] sm:text-4xl">
              Online Training
            </h1>
            <p className="mt-4 max-w-xl text-lg leading-7 text-[#636363]">
              Complete your assigned courses online. Enter the code from your
              instructor to get started.
            </p>

            <form onSubmit={handleSubmit} className="mt-8">
              <label
                htmlFor="course-code"
                className="font-[family-name:var(--font-oswald)] text-sm font-medium uppercase tracking-wide text-[#002d74]"
              >
                Course code
              </label>
              <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                <input
                  id="course-code"
                  type="text"
                  autoComplete="off"
                  placeholder="EXAMPLE-123"
                  className="min-w-0 flex-1 border-2 border-[#b1b4ba] px-4 py-3 font-bold uppercase tracking-wider text-[#111] outline-none focus:border-[#faa200]"
                  value={code}
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="ncst-btn ncst-btn-filled inline-flex items-center justify-center gap-2 px-6 disabled:cursor-wait disabled:opacity-60"
                >
                  {loading ? "Checking…" : "Start course"}
                  {!loading && <ArrowRight size={17} />}
                </button>
              </div>
              {error && (
                <p role="alert" className="mt-3 text-sm font-semibold text-[#ed1c24]">
                  {error}
                </p>
              )}
            </form>
          </div>
        </div>
      </div>

      <footer className="bg-[#002d74] px-4 py-5 text-center text-sm text-white/60 sm:px-6">
        <p>
          &copy; {new Date().getFullYear()} New Castle School of Trades
        </p>
      </footer>
    </main>
  );
}
