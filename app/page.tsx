"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { parseJsonResponse } from "@/lib/parse-response";
import styles from "./home.module.css";

const steps = [
  {
    title: "Enter your course code",
    text: "Use the code from your instructor, employer, or enrollment email in the toolbar above.",
  },
  {
    title: "Work through your lessons",
    text: "Complete assigned readings, knowledge checks, and narrated visual explainers at your own pace.",
  },
  {
    title: "Finish and keep your record",
    text: "When you complete a program, your progress and certificate stay on file for your school or employer.",
  },
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
      const response = await fetch(`/api/enroll?code=${encodeURIComponent(code.trim())}`);
      const data = await parseJsonResponse<{
        error?: string;
        claimed?: boolean;
        course?: { slug: string };
      }>(response);

      if (!response.ok || data.error) {
        setError(data.error || "That course code was not recognized.");
        setLoading(false);
        return;
      }

      if (data.claimed && data.course) {
        router.push(`/training/${data.course.slug}?code=${encodeURIComponent(code.trim())}`);
      } else {
        router.push(`/enroll?code=${encodeURIComponent(code.trim())}`);
      }
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "We could not connect. Please try again.",
      );
      setLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.topBar}>
        <div className={styles.topBarInner}>
          <div className={styles.topRow}>
            <Link href="/" aria-label="NCST Online Training home">
              <Image
                src="/images/ncst-logo.png"
                alt="New Castle School of Trades"
                width={180}
                height={54}
                className="h-11 w-auto sm:h-12"
                priority
              />
            </Link>

            <div className={styles.toolbarActions}>
              <form onSubmit={handleSubmit} className={styles.codeForm}>
                <label htmlFor="course-code" className="sr-only">
                  Course code
                </label>
                <input
                  id="course-code"
                  type="text"
                  autoComplete="off"
                  placeholder="Course code"
                  className={styles.codeInput}
                  value={code}
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                  aria-describedby={error ? "course-code-error" : undefined}
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="ncst-btn ncst-btn-orange inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm disabled:cursor-wait disabled:opacity-60"
                >
                  {loading ? "Checking…" : "Start course"}
                  {!loading && <ArrowRight size={16} />}
                </button>
              </form>
              <Link href="/admin/login" className={styles.adminLink}>
                Admin login
              </Link>
            </div>
          </div>

          {error && (
            <p id="course-code-error" role="alert" className={styles.error}>
              {error}
            </p>
          )}
        </div>
      </header>

      <div className={styles.hero}>
        <div className={styles.heroInner}>
          <span className={styles.eyebrow}>NCST Online Training</span>
          <h1 className={styles.title}>
            Start your assigned course.
            <span className={styles.accent}>Learn at your own pace.</span>
          </h1>
          <p className={styles.lead}>
            This portal delivers safety and compliance training for New Castle School of
            Trades students and partner employers. Enter your course code in the toolbar
            above to open your program.
          </p>

          <ol className={styles.steps}>
            {steps.map((step, index) => (
              <li key={step.title} className={styles.step}>
                <span className={styles.stepNumber}>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <h2 className={styles.stepTitle}>{step.title}</h2>
                  <p className={styles.stepText}>{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <footer className={styles.bottomBar}>
        <p>&copy; {new Date().getFullYear()} New Castle School of Trades</p>
      </footer>
    </main>
  );
}
