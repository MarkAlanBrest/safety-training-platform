"use client";
import { useEffect, useState } from "react";
import { Hammer, Trees, Megaphone, Expand, Video } from "lucide-react";
import ShopWebcam from "@/components/ShopWebcam";
import { activeShopAlarm, assignCleanupStudents, defaultShopDashboard, formatShopDateTime, SHOP_CLEANUP_CATEGORIES, shopCleanupCategoryLabels, shopDateKey, type ShopDashboard } from "@/lib/shop-dashboard";
import "@/app/shop-display/shop-display.css";

export default function ShopDisplay({ preview }: { preview?: ShopDashboard }) {
  const [content, setContent] = useState(defaultShopDashboard);
  const [now, setNow] = useState<Date | null>(null);
  const [slide, setSlide] = useState(0);
  const [status, setStatus] = useState("");
  const data = preview ?? content;
  useEffect(() => {
    const clock = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(clock);
  }, []);
  useEffect(() => {
    if (preview) return;
    let alive = true;
    const refresh = async () => {
      try {
        const response = await fetch("/api/shop-dashboard", { cache: "no-store" });
        if (!response.ok) throw new Error();
        const next = await response.json();
        if (alive) { setContent(next); setStatus(""); }
      } catch { if (alive) setStatus("Connection lost · retrying automatically"); }
    };
    void refresh();
    const timer = setInterval(refresh, 15000);
    return () => { alive = false; clearInterval(timer); };
  }, [preview]);
  useEffect(() => {
    const seconds = Number.isFinite(data.slideSeconds) ? Math.max(5, Math.min(120, data.slideSeconds)) : 12;
    const timer = setInterval(() => setSlide(s => s + 1), seconds * 1000);
    return () => clearInterval(timer);
  }, [data.slideSeconds]);
  const project = data.projects.length ? data.projects[slide % data.projects.length] : null;
  const alarm = now ? activeShopAlarm(data.alarms ?? [], now, data.timezone) : null;
  const alarmIndex = alarm ? data.alarms.indexOf(alarm) : -1;
  const assignments = alarm && now ? assignCleanupStudents(alarm, `${shopDateKey(now, data.timezone)}:${alarm.time}:${alarmIndex}`) : null;
  const format = (options: Intl.DateTimeFormatOptions) => {
    try { return now?.toLocaleString("en-US", { timeZone: data.timezone, ...options }) ?? "—"; }
    catch { return "Check timezone"; }
  };
  let clockLabel = "—";
  try { if (now) clockLabel = formatShopDateTime(now, data.timezone); }
  catch { clockLabel = "Check timezone"; }
  return <div className={`shop-screen ${preview ? "shop-preview" : ""}`}>
    <div className="shop-board">
      <header className="shop-brand shop-wood"><div className="shop-emblem"><Trees /></div><div className="shop-brand-copy"><p>{data.school}</p><h1>{data.title}</h1><small>{data.motto}</small></div><div className="shop-creed"><Hammer /><span>Good work<br />builds<br />good people.</span></div><p className="shop-toolbar-clock">{clockLabel}</p></header>
      <section className="shop-chalk shop-projects"><h2 className="shop-wood"><Hammer /> Student project spotlight <span>{data.projects.length ? `${slide % data.projects.length + 1} / ${data.projects.length}` : "Made in our shop"}</span></h2><div className="shop-photo">{project ? <img key={project.image} src={project.image} alt={project.title} /> : <div className="shop-empty"><Hammer /><p>Great things are taking shape.</p><span>Project photos will appear here.</span></div>}<div className="shop-caption"><span>CRAFTSMANSHIP IN THE MAKING</span><h3>{project?.title ?? "Our next great project starts here"}</h3></div></div></section>
      <div className="shop-lower-panels">
        <section className="shop-chalk shop-notes"><h2 className="shop-wood"><Megaphone /> {data.notesTitle}</h2><p>{data.notes}</p></section>
        <section className="shop-chalk shop-ring"><h2 className="shop-wood"><Video /> Shop webcam</h2><ShopWebcam enabled={!preview} /></section>
      </div>
      <footer className="shop-wood"><Trees />{data.footer}<Trees /></footer>
      {alarm && assignments && <section className="shop-alarm-overlay" role="status" aria-live="polite"><div className="shop-cleanup-board"><header className="shop-cleanup-header"><Megaphone aria-hidden="true" /><div><p>Cleanup assignments</p><h2>{alarm.message}</h2></div></header><div className="shop-cleanup-grid">{SHOP_CLEANUP_CATEGORIES.map(category => <article className={`shop-cleanup-card shop-cleanup-${category}`} key={category}><h3>{shopCleanupCategoryLabels[category]}</h3><p>{alarm.cleanupTasks[category] || "No task description added."}</p><ul>{assignments[category].length ? assignments[category].map(student => <li key={student}>{student}</li>) : <li className="shop-cleanup-unassigned">No students assigned</li>}</ul></article>)}</div><footer>Work safely · Return tools when finished</footer></div></section>}
      {status && <div className="shop-status" role="status">{status}</div>}
    </div>
    {!preview && <button className="shop-fullscreen" title="Enter fullscreen" onClick={() => { void document.documentElement.requestFullscreen().catch(() => setStatus("Use your browser’s fullscreen option.")); }}><Expand size={18} /> Fullscreen</button>}
  </div>;
}
