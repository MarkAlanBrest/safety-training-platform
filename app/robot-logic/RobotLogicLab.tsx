"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { units } from "@/lib/robot-logic/curriculum.mjs";
import { editDraft, emptyProgress, isFeedback, readProgress, recordReview, type Feedback, type Progress } from "@/lib/robot-logic/progress";

type Unit = (typeof units)[number];
const storageKey = "robot-logic-v1";

function FeedbackPanel({ feedback: f }: { feedback: Feedback }) {
  return <div className={`feedback ${f.passed ? "success" : ""}`}>
    <div className="eyebrow">{f.mode === "ai" ? "AI COACH FEEDBACK" : "SELF-REVIEW CHECKLIST"}</div>
    <h3>{f.passed ? "Nice work. Your logic checks out." : "Let’s work through it."}</h3>
    <p>{f.summary}</p>
    {f.strengths.length > 0 && <><strong>What works</strong><ul>{f.strengths.map((item, i) => <li key={i}>{item}</li>)}</ul></>}
    {f.improvements.length > 0 && <><strong>{f.mode === "ai" ? "What to revisit" : "Check your solution"}</strong><ul>{f.improvements.map((item, i) => <li key={i}>{item}</li>)}</ul></>}
    <p><strong>Next step:</strong> {f.nextStep}</p>
  </div>;
}

export default function RobotLogicLab() {
  const [progress, setProgress] = useState<Progress>(emptyProgress);
  const progressRef = useRef(progress);
  const [hash, setHash] = useState("");
  const [ready, setReady] = useState(false);
  const [storageFailed, setStorageFailed] = useState(false);
  const [ai, setAi] = useState<boolean | null>(null);
  const [statusError, setStatusError] = useState(false);
  const [filter, setFilter] = useState("all");
  const [pending, setPending] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const controller = useRef<AbortController | null>(null);
  const answerInput = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const syncHash = () => setHash(window.location.hash);
    syncHash();
    window.addEventListener("hashchange", syncHash);
    try {
      const saved = readProgress(localStorage.getItem(storageKey), units.map(u => u.id));
      progressRef.current = saved;
      setProgress(saved);
    } catch { setStorageFailed(true); }
    setReady(true);
    const statusController = new AbortController();
    fetch("/api/robot-logic/status", { signal: statusController.signal })
      .then(async response => { if (!response.ok) throw new Error(); return response.json(); })
      .then(result => { if (!statusController.signal.aborted) setAi(result.ai === true); })
      .catch(() => { if (!statusController.signal.aborted) setStatusError(true); });
    return () => {
      window.removeEventListener("hashchange", syncHash);
      statusController.abort();
      controller.current?.abort();
      controller.current = null;
    };
  }, []);

  function update(next: Progress) {
    progressRef.current = next;
    setProgress(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); }
    catch { setStorageFailed(true); }
  }

  function navigate(next: string) {
    setHash(next);
    window.scrollTo({ top: 0 });
  }

  async function review(unit: Unit) {
    if (controller.current) return;
    const answer = (progressRef.current.drafts[unit.id] || "").trim();
    if (answer.length < 15) {
      setErrors(current => ({ ...current, [unit.id]: "Write a few clear steps first (at least 15 characters)." }));
      answerInput.current?.focus();
      return;
    }
    const abort = new AbortController();
    controller.current = abort;
    setPending(unit.id);
    setErrors(current => ({ ...current, [unit.id]: "" }));
    try {
      const response = await fetch("/api/robot-logic/feedback", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitId: unit.id, answer }), signal: abort.signal,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The coach could not finish this review. Please retry.");
      if (!isFeedback(result)) throw new Error("The coach returned an incomplete review. Please retry.");
      if (!abort.signal.aborted) update(recordReview(progressRef.current, unit.id, answer, result));
    } catch (error) {
      if (!abort.signal.aborted) setErrors(current => ({ ...current, [unit.id]: error instanceof Error ? error.message : "Connection failed. Please retry." }));
    } finally {
      if (controller.current === abort) {
        controller.current = null;
        setPending(null);
      }
    }
  }

  const selected = units.find(u => hash === `#unit/${u.id}`);
  const complete = (u: Unit) => progress.quiz[u.id] === true && progress.passed[u.id] === true;
  const count = units.filter(complete).length;
  const next = units.find(u => !complete(u)) || units[0];
  const filtered = units.filter(u => filter === "all" || (filter === "complete" ? complete(u) : !complete(u) && (!!progress.drafts[u.id] || progress.quiz[u.id] !== undefined)));
  const unitLink = (u: Unit) => `#unit/${u.id}`;

  return <div className="robot-lab">
    <aside className="sidebar">
      <a className="brand" href="#" onClick={() => navigate("")}><span className="brand-icon">⌘</span><span>robot<span className="light">logic</span><small>THE LEARNING LAB</small></span></a>
      <div className="sidebar-label">YOUR WORKSPACE</div>
      <a className={`nav-link ${!selected && hash !== "#glossary" ? "active" : ""}`} href="#" onClick={() => navigate("")}>▦ <span>Learning path</span><span>08</span></a>
      <div className="sidebar-label">THE TOOLKIT</div>
      <a className={`nav-link ${hash === "#glossary" ? "active" : ""}`} href="#glossary" onClick={() => navigate("#glossary")}>⌁ <span>Pseudocode reference</span></a>
      <div className="sidebar-bottom"><span className="tiny-pill">FTC INSPIRED</span><h3>Big ideas.<br />Small steps.</h3><p>Every great robot starts with a little logic.</p><div className="student"><span className="avatar">S</span><div>Student workspace<small>Progress saved on this device</small></div></div></div>
    </aside>
    <div className="main">
      <header><Link href="/" className="training-back">← Training Studio</Link><span className="status"><i className={ai ? "connected" : ""} />{statusError ? "Coach status unavailable" : ai === null ? "Checking coach…" : ai ? "AI coach configured" : "Self-review mode"}</span></header>
      {storageFailed && <p className="storage-warning" role="status">Browser storage is unavailable. Keep a copy of your work before leaving.</p>}
      {!ready ? <section className="lesson" aria-live="polite"><p>Loading your learning workspace…</p></section> : selected ? <section className="lesson" key={selected.id}>
        <a className="back" href="#" onClick={() => navigate("")}>← All units</a>
        <div className="eyebrow">UNIT {selected.icon} / {selected.tag.toUpperCase()} / {selected.minutes} MIN</div>
        <h1>{selected.title}</h1><p className="lesson-intro">{selected.summary}</p>
        <div className="lesson-grid"><div>
          <article className="paper"><span className="step-label">01 / UNDERSTAND</span><h2>The big idea</h2><p>{selected.concept}</p><div className="connection"><strong>On the robot</strong><p>{selected.connection}</p></div><h3>See it in pseudocode</h3><div className="code-title"><span>EXAMPLE.pseudo</span><span>READ → TRACE → UNDERSTAND</span></div><pre><code>{selected.example}</code></pre><ol>{selected.explain.map(item => <li key={item}>{item}</li>)}</ol></article>
          <article className="paper"><span className="step-label">02 / CHECK YOUR UNDERSTANDING</span><h2>{selected.quiz.q}</h2><div className="quiz-options">{selected.quiz.options.map((option, index) => <button key={option} onClick={() => update({ ...progressRef.current, quiz: { ...progressRef.current.quiz, [selected.id]: index === selected.quiz.answer } })}>{String.fromCharCode(65 + index)}<span>{option}</span></button>)}</div><p role="status">{progress.quiz[selected.id] !== undefined && `${progress.quiz[selected.id] ? "✓ Correct." : "Not quite."} ${selected.quiz.why}`}</p></article>
          <article className="paper practice"><span className="step-label">03 / YOUR TURN</span><h2>Put your logic to work.</h2><p>{selected.task}</p><details><summary>Need a nudge?</summary><p>{selected.hint}</p></details><label htmlFor="robot-answer">Your pseudocode <span>Plain English is welcome.</span></label>
            <textarea id="robot-answer" ref={answerInput} maxLength={6000} spellCheck={false} value={progress.drafts[selected.id] || ""} readOnly={pending === selected.id} placeholder={"WAIT FOR START\n// Write your plan, one step at a time..."} onChange={event => { update(editDraft(progressRef.current, selected.id, event.target.value)); setErrors(current => ({ ...current, [selected.id]: "" })); }} />
            <div className="editor-footer"><span>{storageFailed ? "Draft could not be saved" : "Draft saved on this device"}</span><span>{(progress.drafts[selected.id] || "").length} / 6,000</span></div>
            <p className="privacy">{ai || statusError ? "Checking sends this answer to OpenAI for feedback when the coach is configured. Avoid personal information." : ai === null ? "Checking whether AI coaching is configured…" : "AI is not connected. You can practice and use the self-review checklist."}</p>
            <button className="button primary" disabled={pending !== null || (ai === null && !statusError)} onClick={() => review(selected)}>{pending === selected.id ? "Reviewing your logic…" : ai === false ? "Review my checklist" : "Check my logic"} <span>✦</span></button>
            <div aria-live="polite" aria-busy={pending === selected.id}>{errors[selected.id] && <p role="alert">{errors[selected.id]}</p>}{progress.feedback[selected.id] && <FeedbackPanel feedback={progress.feedback[selected.id]} />}</div>
          </article>
        </div><aside className="lesson-side"><div className="paper"><div className="eyebrow">YOUR MISSION</div><h3>Small steps. Real understanding.</h3><ul className="milestones"><li>Read the lesson &amp; example</li><li>{progress.quiz[selected.id] ? "✓" : "○"} Pass the knowledge check</li><li>{progress.passed[selected.id] ? "✓" : "○"} Get your practice AI-checked</li></ul><p>{complete(selected) ? "Unit complete! You’re ready to keep exploring." : "Complete both checks to finish this unit. You can explore any unit at any time."}</p><a className="button secondary" href={unitLink(units[(units.indexOf(selected) + 1) % units.length])} onClick={() => navigate(unitLink(units[(units.indexOf(selected) + 1) % units.length]))}>{units.indexOf(selected) === 7 ? "Revisit first unit" : "Explore next unit"} →</a></div><div className="tip"><span>✳</span><h3>Think before syntax.</h3><p>There’s no single perfect way to write pseudocode. Clear steps and sound logic matter most.</p></div></aside></div>
      </section> : hash === "#glossary" ? <Reference onBack={() => navigate("")} /> : <>
        <section className="hero"><div><div className="eyebrow">FROM FIRST STEPS TO FIRST ROBOT</div><h1>Think it through.<br /><em>Make it move.</em></h1><p>Learn the logic behind the robot. Bite-sized lessons, real robotics examples, and a place to put your ideas into practice.</p><a className="button primary" href={unitLink(next)} onClick={() => navigate(unitLink(next))}>{count ? "Continue learning" : "Start your first unit"} <span>↗</span></a><div className="hero-meta"><span>◎ Beginner friendly</span><span>◷ At your own pace</span></div></div><div className="robot-art" role="img" aria-label="A robot following a planned path"><div className="art-label">IDEA → LOGIC → ACTION</div><div className="path-line" /><div className="robot"><div className="eyes"><i /><i /></div><div className="robot-body">R / 01</div><span className="wheel left" /><span className="wheel right" /></div><div className="code-chip">IF curious THEN<br /><strong>&nbsp; START learning</strong></div><span className="target">+</span><div className="art-caption">YOUR NEXT MOVE STARTS HERE.</div></div></section>
        <section className="progress-panel"><div className="progress-icon">↗</div><div><strong>Your learning journey</strong><p>{count === 8 ? "All units complete. Your autonomous plan is ready to revisit." : "Build your skills, one small win at a time."}</p></div><div className="progress-right"><span><b>{count} of 8</b> units complete</span><progress aria-label="Units completed" max={8} value={count} /></div></section>
        <section className="unit-section"><div className="section-title"><div className="eyebrow">THE BUILDING BLOCKS</div><h2>Choose your next discovery<span>08 UNITS</span></h2><p>Follow the path or jump into something that sparks your curiosity.</p></div><div className="filters" role="group" aria-label="Filter units">{[["all", "All units"], ["started", "In progress"], ["complete", "Completed"]].map(([id, label]) => <button key={id} className={filter === id ? "selected" : ""} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>)}</div><div className="unit-grid">{filtered.map(u => <a className={`unit-card ${complete(u) ? "done" : ""}`} key={u.id} href={unitLink(u)} onClick={() => navigate(unitLink(u))}><div className="card-top"><span className="unit-number">{u.icon}</span><span>{complete(u) ? "✓ Complete" : `${u.minutes} MIN · ${u.id === "mission" ? "CHALLENGE" : "LESSON"}`}</span></div><div className="unit-tag">{u.tag}</div><h3>{u.title}</h3><p>{u.summary}</p><div className="card-bottom"><span>{complete(u) ? "Revisit unit" : progress.drafts[u.id] ? "Keep exploring" : "Explore unit"}</span><span>↗</span></div></a>)}{!filtered.length && <p className="empty">No units here yet. Choose “All units” to start exploring.</p>}</div></section>
        <section className="closing"><span>✦</span><div><h3>You don’t need to know how to code. Yet.</h3><p>Bring your curiosity. We’ll start with the thinking that makes great code possible.</p></div></section>
      </>}
      <footer>Made for curious minds and future robot builders.<span>ROBOT LOGIC LAB · INDEPENDENT FTC-INSPIRED LEARNING</span></footer>
    </div>
  </div>;
}

function Reference({ onBack }: { onBack: () => void }) {
  const entries = [
    ["SET", "Store or update a value.", "SET count = count + 1"],
    ["IF / ELSE", "Choose between two actions.", "IF distance <= 10 THEN\n  STOP drivetrain\nELSE\n  DRIVE forward\nEND IF"],
    ["AND / OR / NOT", "Combine or invert true/false conditions.", "IF active AND NOT limitPressed THEN"],
    ["WHILE", "Repeat while a condition is true.", "WHILE active AND timer < 3 seconds\n  READ sensor\nEND WHILE"],
    ["FUNCTION / CALL", "Define a reusable behavior, then use it.", "FUNCTION stopRobot()\n  STOP all motors\nEND FUNCTION\nCALL stopRobot()"],
    ["// Comments", "Explain intent and expected test results.", "// At exactly 10 cm, the robot stops."],
  ];
  return <section className="lesson"><a className="back" href="#" onClick={onBack}>← Learning path</a><div className="eyebrow">KEEP THIS HANDY</div><h1>A little language.<br />A lot of possibility.</h1><p className="lesson-intro">Pseudocode is flexible. These conventions help your team read your plan.</p><div className="reference-grid">{entries.map(([name, description, code]) => <article className="paper" key={name}><h2>{name}</h2><p>{description}</p><pre>{code}</pre></article>)}</div><p>Illustrative commands such as DRIVE, READ, and WAIT are conceptual helpers, not FTC SDK methods. Units and stop conditions should always be explicit.</p></section>;
}
