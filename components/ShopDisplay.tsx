"use client";
import { useEffect, useState } from "react";
import { Hammer, Trees, Megaphone, Expand, Video } from "lucide-react";
import ShopWeather from "@/components/ShopWeather";
import { activeShopAlarm, defaultShopDashboard, type ShopDashboard } from "@/lib/shop-dashboard";
import "@/app/shop-display/shop-display.css";

const RING_DASHBOARD_URL = "https://ring.com/users/sign_in?return=account&path=%2Faccount%2Fdashboard%3Fl%3D6dd9d39e-848d-49e7-8bc5-4f7561ffd363%26lv_d%3D720198591";

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
  // Alternate every 5 seconds. Alarms start on a whole minute, so each one opens on the alarm screen.
  const showAlarm = !!alarm && !!now && Math.floor(now.getTime() / 5000) % 2 === 0;
  const format = (options: Intl.DateTimeFormatOptions) => {
    try { return now?.toLocaleString("en-US", { timeZone: data.timezone, ...options }) ?? "—"; }
    catch { return "Check timezone"; }
  };
  return <div className={`shop-screen ${preview ? "shop-preview" : ""}`}>
    <div className="shop-board">
      <header className="shop-brand shop-wood"><div className="shop-emblem"><Trees /></div><div><p>{data.school}</p><h1>{data.title}</h1><small>{data.motto}</small></div><div className="shop-creed"><Hammer /><span>Good work<br />builds<br />good people.</span></div></header>
      <div className="shop-info"><section className="shop-chalk shop-clock"><p>{format({ weekday: "long" })}</p><span>{format({ month: "long", day: "numeric", year: "numeric" })}</span><strong>{format({ hour: "numeric", minute: "2-digit" })}</strong></section><ShopWeather /></div>
      <section className="shop-chalk shop-projects"><h2 className="shop-wood"><Hammer /> Student project spotlight <span>{data.projects.length ? `${slide % data.projects.length + 1} / ${data.projects.length}` : "Made in our shop"}</span></h2><div className="shop-photo">{project ? <img key={project.image} src={project.image} alt={project.title} /> : <div className="shop-empty"><Hammer /><p>Great things are taking shape.</p><span>Project photos will appear here.</span></div>}<div className="shop-caption"><span>CRAFTSMANSHIP IN THE MAKING</span><h3>{project?.title ?? "Our next great project starts here"}</h3></div></div></section>
      <div className="shop-lower-panels">
        <section className="shop-chalk shop-notes"><h2 className="shop-wood"><Megaphone /> {data.notesTitle}</h2><p>{data.notes}</p></section>
        <section className="shop-chalk shop-ring"><h2 className="shop-wood"><Video /> Ring doorbell</h2><iframe src={RING_DASHBOARD_URL} title="Ring doorbell dashboard" referrerPolicy="no-referrer" /><a href={RING_DASHBOARD_URL} target="_blank" rel="noopener noreferrer">Open Ring in a new tab ↗</a></section>
      </div>
      <footer className="shop-wood"><Trees />{data.footer}<Trees /></footer>
      {alarm && showAlarm && <section className="shop-alarm-overlay" role="status" aria-live="polite"><div><Megaphone aria-hidden="true" /><p>Shop announcement</p><h2 className={alarm.message.length > 90 ? "shop-alarm-long" : alarm.message.length > 30 ? "shop-alarm-medium" : ""}>{alarm.message}</h2></div></section>}
      {status && <div className="shop-status" role="status">{status}</div>}
    </div>
    {!preview && <button className="shop-fullscreen" title="Enter fullscreen" onClick={() => { void document.documentElement.requestFullscreen().catch(() => setStatus("Use your browser’s fullscreen option.")); }}><Expand size={18} /> Fullscreen</button>}
  </div>;
}
