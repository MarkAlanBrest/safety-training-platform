"use client";

import { useEffect, useRef, useState } from "react";
import { tracks, units } from "@/lib/robot-logic/curriculum.mjs";
import { editDraft, emptyProgress, isFeedback, readProgress, recordReview, type Feedback, type Progress } from "@/lib/robot-logic/progress";

type Unit = (typeof units)[number] & {
  controls?: string[][];
  deepDive?: { h: string; p: string; code?: string }[];
  java?: string;
  pitfalls?: string[];
  challenge?: boolean;
  objective?: string;
  outcomes?: string[];
  keyTerms?: string[][];
  walkthrough?: { h: string; p: string[]; code?: string }[];
};
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

  // Keep the current track's tab visible when the toolbar scrolls on small screens.
  useEffect(() => {
    document.querySelector(".robot-lab .topnav .active")?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [hash, ready]);

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

  const selected = (units as Unit[]).find(u => hash === `#unit/${u.id}`);
  const activeTrack = tracks.find(t => hash === `#track/${t.id}`);
  const complete = (u: Unit) => progress.quiz[u.id] === true && progress.passed[u.id] === true;
  const count = units.filter(complete).length;
  const next = units.find(u => !complete(u)) || units[0];
  const unitLink = (u: Unit) => `#unit/${u.id}`;
  const trackOf = (u: Unit) => tracks.find(t => t.id === u.track) || tracks[0];
  const trackUnits = (id: string) => units.filter(u => u.track === id);
  const nextUnit = selected && units[(units.indexOf(selected) + 1) % units.length];
  const isLast = selected && units.indexOf(selected) === units.length - 1;
  let step = 0;
  const stepLabel = (name: string) => `${String(++step).padStart(2, "0")} / ${name}`;

  return <div className="robot-lab">
    <header className="topbar">
      <a className="brand" href="#" onClick={() => navigate("")}><span className="brand-icon">⌘</span><span>robot<span className="light">logic</span><small>THE LEARNING LAB</small></span></a>
      <nav className="topnav" aria-label="Robot Logic Lab">
        <a className={`nav-link ${!selected && !activeTrack && hash !== "#glossary" ? "active" : ""}`} href="#" onClick={() => navigate("")}><span>Home</span></a>
        {tracks.map(t => <a key={t.id} data-track={t.id} className={`nav-link ${activeTrack?.id === t.id || selected?.track === t.id ? "active" : ""}`} href={`#track/${t.id}`} onClick={() => navigate(`#track/${t.id}`)}><span className="track-code">{t.code}</span><span>{t.title}</span><small>{trackUnits(t.id).filter(complete).length}/{trackUnits(t.id).length}</small></a>)}
        <a className={`nav-link ${hash === "#glossary" ? "active" : ""}`} href="#glossary" onClick={() => navigate("#glossary")}><span>Reference</span></a>
      </nav>
      <span className="status" title={statusError ? "Coach status unavailable" : ai === null ? "Checking coach…" : ai ? "AI coach configured" : "Self-review mode"}><i className={ai ? "connected" : ""} /><span>{statusError ? "Coach status unavailable" : ai === null ? "Checking coach…" : ai ? "AI coach configured" : "Self-review mode"}</span></span>
    </header>
    <div className="main">
      {storageFailed && <p className="storage-warning" role="status">Browser storage is unavailable. Keep a copy of your work before leaving.</p>}
      {!ready ? <section className="lesson" aria-live="polite"><p>Loading your learning workspace…</p></section> : selected ? <section className="lesson" key={selected.id} data-track={selected.track}>
        <div className="lesson-head">
          <a className="back" href={`#track/${selected.track}`} onClick={() => navigate(`#track/${selected.track}`)}>← {trackOf(selected).title}</a>
          <span className="track-pill"><span className="track-code">{trackOf(selected).code}</span>{trackOf(selected).title}</span>
          <div className="eyebrow">UNIT {selected.icon} / {selected.tag.toUpperCase()} / {selected.minutes} MIN</div>
          <h1>{selected.title}</h1><p className="lesson-intro">{selected.summary}</p>
          {selected.objective && <div className="objective"><div className="objective-main"><span className="objective-label">OBJECTIVE</span><p>{selected.objective}</p></div>{selected.outcomes && <div className="objective-outcomes"><span className="objective-label">YOU WILL BE ABLE TO</span><ul>{selected.outcomes.map(item => <li key={item}>{item}</li>)}</ul></div>}</div>}
        </div>
        <div className="lesson-grid"><div>
          {selected.keyTerms && <article className="paper key-terms"><span className="step-label">{stepLabel("KEY TERMS")}</span><h2>Words to know</h2><dl>{selected.keyTerms.map(([term, definition]) => <div key={term}><dt>{term}</dt><dd>{definition}</dd></div>)}</dl></article>}
          <article className="paper"><span className="step-label">{stepLabel("UNDERSTAND")}</span><h2>The big idea</h2><p>{selected.concept}</p><div className="connection"><strong>On the robot</strong><p>{selected.connection}</p></div>
            {selected.controls && <><h3>What your code controls</h3><div className="table-wrap"><table className="controls-table"><thead><tr><th>Item</th><th>What code does with it</th><th>Values &amp; units</th></tr></thead><tbody>{selected.controls.map(([item, what, values]) => <tr key={item}><th scope="row">{item}</th><td>{what}</td><td>{values}</td></tr>)}</tbody></table></div></>}
            <h3>See it in pseudocode</h3><div className="code-title"><span>EXAMPLE.pseudo</span><span>READ → TRACE → UNDERSTAND</span></div><pre><code>{selected.example}</code></pre><ol>{selected.explain.map(item => <li key={item}>{item}</li>)}</ol></article>
          {selected.walkthrough && <article className="paper walkthrough"><span className="step-label">{stepLabel("LEARN IT STEP BY STEP")}</span><h2>How it works</h2>
            {selected.walkthrough.map((section, index) => <section key={section.h}><h3><span className="walk-number">{index + 1}</span>{section.h}</h3>{section.p.map(text => <p key={text}>{text}</p>)}{section.code && <pre><code>{section.code}</code></pre>}</section>)}
          </article>}
          {(selected.deepDive || selected.java || selected.pitfalls) && <article className="paper deep-dive"><span className="step-label">{stepLabel("GO DEEPER")}</span><h2>What the pros know</h2>
            {selected.deepDive?.map(section => <section key={section.h}><h3>{section.h}</h3><p>{section.p}</p>{section.code && <pre><code>{section.code}</code></pre>}</section>)}
            {selected.java && <details className="java-peek"><summary>Peek at real FTC SDK Java</summary><p>The same idea as it looks in an FTC Java OpMode. Device names and constants are examples.</p><pre><code>{selected.java}</code></pre></details>}
            {selected.pitfalls && <div className="pitfalls"><strong>Common mistakes</strong><ul>{selected.pitfalls.map(item => <li key={item}>{item}</li>)}</ul></div>}
          </article>}
          <article className="paper"><span className="step-label">{stepLabel("CHECK YOUR UNDERSTANDING")}</span><h2>{selected.quiz.q}</h2><div className="quiz-options">{selected.quiz.options.map((option, index) => <button key={option} onClick={() => update({ ...progressRef.current, quiz: { ...progressRef.current.quiz, [selected.id]: index === selected.quiz.answer } })}>{String.fromCharCode(65 + index)}<span>{option}</span></button>)}</div><p role="status">{progress.quiz[selected.id] !== undefined && `${progress.quiz[selected.id] ? "✓ Correct." : "Not quite."} ${selected.quiz.why}`}</p></article>
          <article className="paper practice"><span className="step-label">{stepLabel("YOUR TURN")}</span><h2>Put your logic to work.</h2><p>{selected.task}</p><details><summary>Need a nudge?</summary><p>{selected.hint}</p></details><label htmlFor="robot-answer">Your pseudocode <span>Plain English is welcome.</span></label>
            <textarea id="robot-answer" ref={answerInput} maxLength={6000} spellCheck={false} value={progress.drafts[selected.id] || ""} readOnly={pending === selected.id} placeholder={"WAIT FOR START\n// Write your plan, one step at a time..."} onChange={event => { update(editDraft(progressRef.current, selected.id, event.target.value)); setErrors(current => ({ ...current, [selected.id]: "" })); }} />
            <div className="editor-footer"><span>{storageFailed ? "Draft could not be saved" : "Draft saved on this device"}</span><span>{(progress.drafts[selected.id] || "").length} / 6,000</span></div>
            <p className="privacy">{ai || statusError ? "Checking sends this answer to OpenAI for feedback when the coach is configured. Avoid personal information." : ai === null ? "Checking whether AI coaching is configured…" : "AI is not connected. You can practice and use the self-review checklist."}</p>
            <button className="button primary" disabled={pending !== null || (ai === null && !statusError)} onClick={() => review(selected)}>{pending === selected.id ? "Reviewing your logic…" : ai === false ? "Review my checklist" : "Check my logic"} <span>✦</span></button>
            <div aria-live="polite" aria-busy={pending === selected.id}>{errors[selected.id] && <p role="alert">{errors[selected.id]}</p>}{progress.feedback[selected.id] && <FeedbackPanel feedback={progress.feedback[selected.id]} />}</div>
          </article>
        </div><aside className="lesson-side"><div className="paper"><div className="eyebrow">YOUR MISSION</div><h3>Small steps. Real understanding.</h3><p className="track-progress">{trackOf(selected).title}: {trackUnits(selected.track).filter(complete).length} of {trackUnits(selected.track).length} complete</p><ul className="milestones"><li>Learn the key terms</li><li>Read the lesson &amp; example</li><li>{progress.quiz[selected.id] ? "✓" : "○"} Pass the knowledge check</li><li>{progress.passed[selected.id] ? "✓" : "○"} Get your practice AI-checked</li></ul><p>{complete(selected) ? "Unit complete! You’re ready to keep exploring." : "Complete both checks to finish this unit. You can explore any unit at any time."}</p>{nextUnit && <a className="button secondary" href={unitLink(nextUnit)} onClick={() => navigate(unitLink(nextUnit))}>{isLast ? "Revisit first unit" : nextUnit.track !== selected.track ? `Start ${trackOf(nextUnit).title}` : "Explore next unit"} →</a>}</div><div className="tip"><span>✳</span><h3>Think before syntax.</h3><p>There’s no single perfect way to write pseudocode. Clear steps and sound logic matter most.</p></div></aside></div>
      </section> : hash === "#glossary" ? <Reference onBack={() => navigate("")} /> :
        activeTrack ? <section className="unit-section track-units" data-track={activeTrack.id}><div className="unit-grid">{(units as Unit[]).filter(u => u.track === activeTrack.id).map(u => <a className={`unit-card ${complete(u) ? "done" : ""}`} data-track={u.track} key={u.id} href={unitLink(u)} onClick={() => navigate(unitLink(u))}><div className="card-top"><span className="unit-number">{u.icon}</span><span>{complete(u) ? "✓ Complete" : `${u.minutes} MIN · ${u.challenge ? "CHALLENGE" : "LESSON"}`}</span></div><div className="unit-tag">{u.tag}</div><h3>{u.title}</h3><p>{u.summary}</p><div className="card-bottom"><span>{complete(u) ? "Revisit unit" : progress.drafts[u.id] ? "Keep exploring" : "Explore unit"}</span><span>↗</span></div></a>)}</div></section> : <section className="hero"><div><div className="eyebrow">FROM FIRST STEPS TO FIRST ROBOT</div><h1>Think it through.<br /><em>Make it move.</em></h1><p>The team&apos;s programming lab. Start with pseudocode and logic, then learn what every motor, servo, sensor, mecanum drive, intake, outtake, and Limelight can do from code.</p><a className="button primary" href={unitLink(next)} onClick={() => navigate(unitLink(next))}>{count ? "Continue learning" : "Start your first unit"} <span>↗</span></a><div className="hero-meta"><span>◎ Beginner friendly</span><span>◷ At your own pace</span></div></div><div className="robot-art" role="img" aria-label="A robot following a planned path"><div className="art-label">IDEA → LOGIC → ACTION</div><div className="path-line" /><div className="robot"><div className="eyes"><i /><i /></div><div className="robot-body">R / 01</div><span className="wheel left" /><span className="wheel right" /></div><div className="code-chip">IF curious THEN<br /><strong>&nbsp; START learning</strong></div><span className="target">+</span><div className="art-caption">YOUR NEXT MOVE STARTS HERE.</div></div></section>}
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
    ["ELSE IF", "Pick exactly one of several branches, checked top to bottom.", "IF d <= 10 THEN\n  STOP\nELSE IF d <= 40 THEN\n  DRIVE at 0.2\nELSE\n  DRIVE at 0.6\nEND IF"],
    ["FOR EACH / lists", "Visit every item in a list. Indexes start at 0.", "SET heights = [0, 1200, 2400]\nFOR EACH tag IN detections\n  DISPLAY tag.id\nEND FOR"],
    ["RETURN", "Send a value back from a function.", "FUNCTION clamp(v, lo, hi)\n  IF v < lo THEN RETURN lo\n  IF v > hi THEN RETURN hi\n  RETURN v\nEND FUNCTION"],
    ["Edge detection", "Act once per button press, not every loop.", "IF aNow AND NOT aBefore THEN\n  SET open = NOT open\nEND IF\nSET aBefore = aNow"],
    ["Timers", "Wait without freezing the loop.", "RESET timer\n...\nIF timer > 0.5 seconds THEN\n  LOWER lift\nEND IF"],
    ["STATE", "Keep one named state and move between states on conditions.", "IF state = LIFTING AND liftAtTarget THEN\n  SET state = SCORING\nEND IF"],
  ];
  const cheats = [
    ["DC motor power", "-1.0 to 1.0", "Direction FORWARD/REVERSE; zero power BRAKE or FLOAT"],
    ["Encoder", "Ticks", "inches = ticks ÷ ticks per inch; reset before trusting"],
    ["Servo", "Position 0.0 to 1.0", "No real feedback on most servos; CR servos take power -1 to 1"],
    ["Touch / limit switch", "true / false", "Check which value means triggered"],
    ["Distance sensor", "cm, mm, or inches", "Out of range gives a very large value"],
    ["Color sensor", "RGB 0–1, hue 0–360", "Use hue with margins; calibrate on the field"],
    ["IMU yaw", "-180° to 180°", "Counterclockwise is positive; normalize errors"],
    ["Gamepad stick", "-1 to 1", "Forward on a stick reads negative y"],
    ["Mecanum wheels", "FL = y+x+rx, BL = y−x+rx", "FR = y−x−rx, BR = y+x−rx, ÷ max(|y|+|x|+|rx|, 1)"],
    ["Limelight tx / ty / ta", "Degrees, degrees, % area", "Positive tx = target right; always check isValid()"],
    ["AprilTag botpose", "Meters, field coordinates", "× 39.37 for inches; MegaTag2 needs IMU yaw each loop"],
    ["Battery", "~12–14 V", "Scale power by 12 ÷ voltage for consistency"],
  ];
  return <section className="lesson"><a className="back" href="#" onClick={onBack}>← Learning path</a><div className="eyebrow">KEEP THIS HANDY</div><h1>A little language.<br />A lot of possibility.</h1><p className="lesson-intro">Pseudocode is flexible. These conventions help your team read your plan.</p><div className="reference-grid">{entries.map(([name, description, code]) => <article className="paper" key={name}><h2>{name}</h2><p>{description}</p><pre>{code}</pre></article>)}</div><p>Illustrative commands such as DRIVE, READ, and WAIT are conceptual helpers, not FTC SDK methods. Units and stop conditions should always be explicit.</p>
    <div className="eyebrow cheat-title">ROBOT CHEAT SHEET</div><h2 className="cheat-heading">Values your code works with</h2><div className="table-wrap paper"><table className="controls-table"><thead><tr><th>Device or value</th><th>Range &amp; units</th><th>Remember</th></tr></thead><tbody>{cheats.map(([name, range, note]) => <tr key={name}><th scope="row">{name}</th><td>{range}</td><td>{note}</td></tr>)}</tbody></table></div></section>;
}
