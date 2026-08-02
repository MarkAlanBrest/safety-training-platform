"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  ArrowUp,
  Award,
  BookOpenCheck,
  LineChart,
  PlayCircle,
} from "lucide-react";
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

const highlights = [
  {
    icon: BookOpenCheck,
    text: "Interactive lessons & knowledge checks",
  },
  {
    icon: PlayCircle,
    text: "Narrated visual explainers",
  },
  {
    icon: LineChart,
    text: "Progress tracked automatically",
  },
  {
    icon: Award,
    text: "Certificate when you finish",
  },
];

export default function HomePage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const codeInputRef = useRef<HTMLInputElement>(null);

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
                  ref={codeInputRef}
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
        <div className={styles.heroBand}>
          <div className={styles.heroBandInner}>
            <span className={styles.eyebrow}>NCST Online Training</span>
            <h1 className={styles.title}>
              Safety training, built
              <span className={styles.accent}>for the trades.</span>
            </h1>

            <div className={styles.heroGrid}>
              <div className={styles.heroCopy}>
                <p className={styles.lead}>
                  New Castle School of Trades delivers safety and compliance training for
                  students and partner employers. Enter the course code from your instructor,
                  employer, or enrollment email in the toolbar above to begin.
                </p>
                <button
                  type="button"
                  onClick={() => codeInputRef.current?.focus()}
                  className="ncst-btn ncst-btn-filled inline-flex items-center gap-2 px-6 py-3 text-sm"
                >
                  Enter your course code
                  <ArrowUp size={16} />
                </button>
              </div>

              <div className={styles.highlightCard}>
                <span className={styles.highlightLabel}>What&rsquo;s inside</span>
                <ul className={styles.highlightList}>
                  {highlights.map(({ icon: Icon, text }) => (
                    <li key={text} className={styles.highlightItem}>
                      <Icon size={18} className={styles.highlightIcon} aria-hidden="true" />
                      <span>{text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.photoBand}>
          <Image
            src="/images/ncst-campus-hero.jpg"
            alt="New Castle School of Trades campus building"
            width={1350}
            height={400}
            className={styles.photoBandImage}
            priority={false}
          />
          <div className={styles.photoBandCaption}>New Castle School of Trades</div>
        </div>

        <div className={styles.stepsSection}>
          <div className={styles.stepsInner}>
            <span className={styles.eyebrow}>How it works</span>
            <h2 className={styles.sectionTitle}>Three steps to get started</h2>

            <ol className={styles.steps}>
              {steps.map((step, index) => (
                <li key={step.title} className={styles.step}>
                  <span className={styles.stepNumber}>
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className={styles.stepTitle}>{step.title}</h3>
                  <p className={styles.stepText}>{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>

      <footer className={styles.bottomBar}>
        <p>&copy; {new Date().getFullYear()} New Castle School of Trades</p>
      </footer>
    </main>
  );
}
