"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { DEFAULT_TOPIC, findTopic, topics } from "@/lib/pseudocode/topics";
import { renderMarkdown } from "@/lib/pseudocode/markdown";
import type { Challenge, Feedback } from "@/lib/pseudocode/coach";

type FeedItem =
  | { id: number; kind: "feedback"; feedback: Feedback }
  | { id: number; kind: "user"; text: string; label?: string }
  | { id: number; kind: "coach"; text: string; pending?: boolean }
  | { id: number; kind: "error"; text: string };

type Workbench = {
  topic: string;
  challenge: Challenge | null;
  code: string;
  feed: FeedItem[];
  latest: Feedback | null;
  passed: boolean;
  history: string[];
  solved: Record<string, number>;
};

type Busy = null | "challenge" | "check" | "ask";

const STORAGE_KEY = "ftc-pseudocode-workbench-v1";
const EXAMPLE = [
  "WAIT FOR START",
  "SET claw servo to 0.8   // close the claw",
  "DRIVE forward at power 0.3",
  "WAIT 2 seconds",
  "STOP drivetrain",
  "SET claw servo to 0.2   // open the claw",
].join("\n");
const ASK_ACTIONS: [string, string][] = [
  ["💡 Hint", "Give me a small hint for this challenge. Don't give away the answer."],
  ["📘 Explain the idea", "Explain the main idea behind this challenge in simple terms."],
  ["🧪 Show an example", "Show me a short example of this idea using a different robot situation than my challenge."],
];

const empty = (): Workbench => ({
  topic: DEFAULT_TOPIC,
  challenge: null,
  code: "",
  feed: [],
  latest: null,
  passed: false,
  history: [],
  solved: {},
});

function load(): Workbench {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved && findTopic(saved.topic) && typeof saved.code === "string" && Array.isArray(saved.feed)) {
      return {
        ...empty(),
        ...saved,
        feed: saved.feed.filter((item: FeedItem) => !(item.kind === "coach" && item.pending)),
      };
    }
  } catch {}
  return empty();
}

const networkMessage = (error: unknown) =>
  error instanceof TypeError ? "Could not reach the coach. Check your connection and try again." : (error as Error).message;

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || "The coach could not answer. Please try again.");
  return data as T;
}

function FeedbackCard({ feedback }: { feedback: Feedback }) {
  return (
    <div className={`wb-card wb-feedback ${feedback.passed ? "passed" : ""}`}>
      <div className="wb-feedback-head">{feedback.passed ? "✓ All requirements met" : "Keep going"}</div>
      <p>{feedback.summary}</p>
      {feedback.works.length > 0 && (
        <>
          <div className="wb-mini-label works">What works</div>
          <ul>
            {feedback.works.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </>
      )}
      {feedback.fixes.length > 0 && (
        <>
          <div className="wb-mini-label fixes">What to fix</div>
          <ul>
            {feedback.fixes.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </>
      )}
      {feedback.tips?.length > 0 && (
        <>
          <div className="wb-mini-label tips">A better way (optional)</div>
          <ul>
            {feedback.tips.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </>
      )}
      {feedback.question && <div className="wb-question">{feedback.question}</div>}
    </div>
  );
}

export default function PseudocodeCoach() {
  const [wb, setWb] = useState<Workbench>(empty);
  const [busy, setBusy] = useState<Busy>(null);
  const [ai, setAi] = useState<boolean | null>(null);
  const [question, setQuestion] = useState("");
  const [notice, setNotice] = useState("");
  const wbRef = useRef(wb);
  const ready = useRef(false);
  const nextId = useRef(1);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  const update = (change: (current: Workbench) => Workbench) => {
    wbRef.current = change(wbRef.current);
    setWb(wbRef.current);
  };
  const newId = () => nextId.current++;

  useEffect(() => {
    const saved = load();
    nextId.current = Math.max(0, ...saved.feed.map((item) => item.id)) + 1;
    wbRef.current = saved;
    setWb(saved);
    ready.current = true;
    fetch("/api/pseudocode/status")
      .then((res) => res.json())
      .then((data) => setAi(Boolean(data.ai)))
      .catch(() => setAi(false));
  }, []);

  useEffect(() => {
    if (!ready.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(wb));
    } catch {}
  }, [wb]);

  useEffect(() => {
    const feed = feedRef.current;
    if (feed) feed.scrollTop = feed.scrollHeight;
  }, [wb.feed]);

  const topic = findTopic(wb.topic) || topics[0];
  const lineCount = Math.max(wb.code.split("\n").length, 14);
  const totalSolved = Object.values(wb.solved).reduce((sum, n) => sum + n, 0);

  async function loadChallenge(topicId: string, harder = false) {
    if (busy) return;
    const current = wbRef.current;
    if (current.challenge && !current.passed && current.code.trim() && !window.confirm("Start a new challenge? Your current code will be cleared.")) {
      return;
    }
    setNotice("");
    update((w) => ({ ...w, topic: topicId }));
    setBusy("challenge");
    try {
      const { challenge } = await postJson<{ challenge: Challenge }>("/api/pseudocode/challenge", {
        topic: topicId,
        previous: current.history.slice(-10),
        harder,
      });
      update((w) => ({
        ...w,
        topic: topicId,
        challenge,
        code: "",
        feed: [],
        latest: null,
        passed: false,
        history: [...w.history, challenge.title].slice(-30),
      }));
      editorRef.current?.focus();
    } catch (error) {
      setNotice(networkMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function checkCode() {
    const current = wbRef.current;
    if (busy || !current.challenge) return;
    if (!current.code.trim()) {
      setNotice("Write your pseudocode in the editor first, then press Check my code.");
      editorRef.current?.focus();
      return;
    }
    setNotice("");
    setBusy("check");
    try {
      const { feedback } = await postJson<{ feedback: Feedback }>("/api/pseudocode/check", {
        topic: current.topic,
        challenge: current.challenge,
        code: current.code,
      });
      update((w) => {
        const firstPass = feedback.passed && !w.passed;
        return {
          ...w,
          latest: feedback,
          passed: w.passed || feedback.passed,
          solved: firstPass ? { ...w.solved, [w.topic]: (w.solved[w.topic] || 0) + 1 } : w.solved,
          feed: [...w.feed, { id: newId(), kind: "feedback", feedback }],
        };
      });
    } catch (error) {
      update((w) => ({ ...w, feed: [...w.feed, { id: newId(), kind: "error", text: networkMessage(error) }] }));
    } finally {
      setBusy(null);
    }
  }

  async function ask(text: string, label?: string) {
    if (busy || !text.trim()) return;
    const replyId = newId();
    update((w) => ({
      ...w,
      feed: [
        ...w.feed,
        { id: newId(), kind: "user", text, ...(label ? { label } : {}) },
        { id: replyId, kind: "coach", text: "", pending: true },
      ],
    }));
    const current = wbRef.current;
    const messages = current.feed
      .filter((item) => (item.kind === "user" || item.kind === "coach") && !("pending" in item && item.pending) && item.text.trim())
      .map((item) => ({ role: item.kind === "user" ? "user" : "assistant", content: (item as { text: string }).text }))
      .slice(-20);
    const setReply = (reply: string, done: boolean, error = false) =>
      update((w) => ({
        ...w,
        feed: w.feed.map((item) =>
          item.id === replyId ? (error ? { id: replyId, kind: "error", text: reply } : { id: replyId, kind: "coach", text: reply, pending: !done }) : item,
        ),
      }));

    setBusy("ask");
    let reply = "";
    try {
      const response = await fetch("/api/pseudocode/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: current.topic, challenge: current.challenge, code: current.code, messages }),
      });
      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "The coach could not answer. Please try again.");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        reply += decoder.decode(value, { stream: true });
        setReply(reply, false);
      }
      if (!reply.trim()) throw new Error("The coach did not send a reply. Please try again.");
      setReply(reply, true);
    } catch (error) {
      if (reply.trim()) setReply(`${reply}\n\n(The connection dropped. Try asking again.)`, true);
      else setReply(networkMessage(error), true, true);
    } finally {
      setBusy(null);
    }
  }

  function submitQuestion(event: FormEvent) {
    event.preventDefault();
    if (!question.trim() || busy) return;
    const text = question;
    setQuestion("");
    ask(text);
  }

  function onEditorKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      checkCode();
    } else if (event.key === "Tab" && !event.shiftKey) {
      // Indent with Tab (two spaces). Press Esc first to Tab out of the editor.
      event.preventDefault();
      const el = event.currentTarget;
      el.setRangeText("  ", el.selectionStart, el.selectionEnd, "end");
      update((w) => ({ ...w, code: el.value }));
    } else if (event.key === "Escape") {
      event.currentTarget.blur();
    }
  }

  function resetAll() {
    if (busy || !window.confirm("Clear your challenge, code, and progress?")) return;
    update(() => empty());
    setNotice("");
  }

  return (
    <div className="wb">
      <header className="wb-top">
        <div className="wb-brand">
          <span className="wb-mark" aria-hidden="true">{"{ }"}</span>
          <div>
            <strong>FTC Pseudocode Coach</strong>
            <span className="wb-status" data-state={ai === null ? "checking" : ai ? "online" : "offline"}>
              {ai === null ? "Connecting…" : ai ? "Coach online" : "Coach offline"}
            </span>
          </div>
        </div>
        <div className="wb-top-right">
          {totalSolved > 0 && <span className="wb-score">🏆 {totalSolved} solved</span>}
          <button type="button" className="wb-link" onClick={resetAll} disabled={busy !== null}>
            Reset
          </button>
        </div>
      </header>

      <div className="wb-body">
        <nav className="wb-side" aria-label="Practice topics">
          <div className="wb-side-label">Topics</div>
          <div className="wb-topic-list">
            {topics.map((t) => (
              <button
                key={t.id}
                type="button"
                className="wb-topic"
                aria-current={t.id === wb.topic ? "true" : undefined}
                disabled={busy !== null}
                onClick={() => loadChallenge(t.id)}
              >
                <span className="wb-topic-icon" aria-hidden="true">{t.icon}</span>
                <span className="wb-topic-text">
                  <span className="wb-topic-name">{t.label}</span>
                  <span className="wb-topic-blurb">{t.blurb}</span>
                </span>
                {wb.solved[t.id] ? <span className="wb-topic-count" title="Challenges solved">{wb.solved[t.id]}</span> : null}
              </button>
            ))}
          </div>
        </nav>

        <main className="wb-main">
          {notice && (
            <div className="wb-notice" role="alert">
              {notice}
              <button type="button" onClick={() => setNotice("")} aria-label="Dismiss">
                ×
              </button>
            </div>
          )}

          {busy === "challenge" ? (
            <section className="wb-card wb-challenge wb-loading" aria-busy="true">
              <div className="wb-tag">
                {topic.icon} {topic.label}
              </div>
              <h1>Building your robot challenge…</h1>
              <div className="wb-skeleton" />
              <div className="wb-skeleton short" />
            </section>
          ) : wb.challenge ? (
            <section className="wb-card wb-challenge" aria-label="Current challenge">
              <div className="wb-challenge-top">
                <div className="wb-tag">
                  {topic.icon} {topic.label}
                </div>
                <button type="button" className="wb-link" onClick={() => loadChallenge(wb.topic)} disabled={busy !== null}>
                  ↻ New challenge
                </button>
              </div>
              <h1>{wb.challenge.title}</h1>
              <p className="wb-task">{wb.challenge.task}</p>
              <ul className="wb-reqs">
                {wb.challenge.requirements.map((req, i) => {
                  const result = wb.latest?.requirements[i];
                  const state = !result ? "todo" : result.met ? "met" : "missed";
                  return (
                    <li key={i} className={state}>
                      <span className="wb-req-icon" aria-label={state === "met" ? "Met" : state === "missed" ? "Not yet" : "Not checked"}>
                        {state === "met" ? "✓" : state === "missed" ? "!" : ""}
                      </span>
                      <span>
                        {req}
                        {result?.note && <span className="wb-req-note">{result.note}</span>}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <details className="wb-concept">
                <summary>About this idea</summary>
                <div dangerouslySetInnerHTML={{ __html: renderMarkdown(wb.challenge.concept) }} />
              </details>
              {wb.passed && (
                <div className="wb-complete">
                  <span>🎉 Challenge complete! Nice work.</span>
                  <button type="button" className="wb-primary" onClick={() => loadChallenge(wb.topic, true)} disabled={busy !== null}>
                    Next challenge ▶
                  </button>
                </div>
              )}
            </section>
          ) : (
            <section className="wb-card wb-challenge wb-welcome">
              <div className="wb-welcome-grid">
                <div>
                  <div className="wb-tag">👋 Welcome</div>
                  <h1>Let&apos;s practice writing pseudocode for your FTC robot</h1>
                  <p className="wb-task">
                    Pseudocode is your robot&apos;s plan written in plain, step-by-step words, before any Java or Blocks. New here?
                    Start with <strong>✏️ Start writing pseudocode</strong> on the left, and the coach will give you a simple robot
                    challenge. Write your plan in the editor, then press <strong>Check my code</strong>.
                  </p>
                  <button type="button" className="wb-primary wb-start" onClick={() => loadChallenge(wb.topic)} disabled={busy !== null}>
                    Get my first challenge ▶
                  </button>
                </div>
                <pre className="wb-example" aria-label="Example pseudocode">
                  <code>{EXAMPLE}</code>
                </pre>
              </div>
            </section>
          )}

          <div className="wb-work">
            <section className="wb-card wb-editor" aria-label="Your pseudocode">
              <div className="wb-panel-head">
                <span>Your pseudocode</span>
                {wb.code && (
                  <button type="button" className="wb-link" onClick={() => update((w) => ({ ...w, code: "" }))} disabled={busy !== null}>
                    Clear
                  </button>
                )}
              </div>
              <div className="wb-editor-box">
                <div className="wb-gutter" ref={gutterRef} aria-hidden="true">
                  {Array.from({ length: lineCount }, (_, i) => (
                    <span key={i}>{i + 1}</span>
                  ))}
                </div>
                <textarea
                  ref={editorRef}
                  value={wb.code}
                  onChange={(event) => {
                    const code = event.target.value;
                    update((w) => ({ ...w, code }));
                  }}
                  onKeyDown={onEditorKeyDown}
                  onScroll={(event) => {
                    if (gutterRef.current) gutterRef.current.scrollTop = event.currentTarget.scrollTop;
                  }}
                  placeholder={wb.challenge ? "WAIT FOR START\n…" : "Pick a topic to get a challenge, or start writing and ask the coach."}
                  aria-label="Pseudocode editor"
                  spellCheck={false}
                  wrap="off"
                />
              </div>
              <div className="wb-editor-actions">
                <span className="wb-keys">Tab indents · Ctrl+Enter checks</span>
                <button
                  type="button"
                  className="wb-primary"
                  onClick={checkCode}
                  disabled={busy !== null || !wb.challenge}
                  title={wb.challenge ? undefined : "Start a challenge first"}
                >
                  {busy === "check" ? "Checking…" : "Check my code ▶"}
                </button>
              </div>
            </section>

            <section className="wb-card wb-coach" aria-label="Coach">
              <div className="wb-panel-head">
                <span>Coach</span>
              </div>
              <div className="wb-feed" ref={feedRef} role="log" aria-label="Coach feedback">
                {wb.feed.length === 0 && busy !== "check" && (
                  <div className="wb-feed-empty">
                    {wb.challenge
                      ? "Write your plan in the editor, then press Check my code. Stuck? Ask for a hint below."
                      : "Feedback on your code and answers to your questions will show up here."}
                  </div>
                )}
                {wb.feed.map((item) => {
                  if (item.kind === "feedback") return <FeedbackCard key={item.id} feedback={item.feedback} />;
                  if (item.kind === "user") {
                    return (
                      <div key={item.id} className="wb-msg user">
                        {item.label || item.text}
                      </div>
                    );
                  }
                  if (item.kind === "error") {
                    return (
                      <div key={item.id} className="wb-msg error" role="alert">
                        {item.text}
                      </div>
                    );
                  }
                  return item.pending && !item.text ? (
                    <div key={item.id} className="wb-msg coach">
                      <span className="wb-typing" role="status" aria-label="Coach is typing">
                        <i />
                        <i />
                        <i />
                      </span>
                    </div>
                  ) : (
                    <div key={item.id} className="wb-msg coach" dangerouslySetInnerHTML={{ __html: renderMarkdown(item.text) }} />
                  );
                })}
                {busy === "check" && (
                  <div className="wb-msg coach">
                    <span className="wb-typing" role="status" aria-label="Checking your code">
                      <i />
                      <i />
                      <i />
                    </span>{" "}
                    Tracing your code…
                  </div>
                )}
              </div>
              <div className="wb-chips">
                {ASK_ACTIONS.map(([label, text]) => (
                  <button key={label} type="button" className="wb-chip" disabled={busy !== null} onClick={() => ask(text, label)}>
                    {label}
                  </button>
                ))}
              </div>
              <form className="wb-ask" onSubmit={submitQuestion}>
                <input
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="Ask the coach a question…"
                  aria-label="Ask the coach a question"
                  maxLength={4000}
                />
                <button type="submit" disabled={busy !== null || !question.trim()}>
                  Ask
                </button>
              </form>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
