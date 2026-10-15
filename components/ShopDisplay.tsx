"use client";
import { useEffect, useState } from "react";
import { Hammer, Trees, ShieldCheck, ClipboardList, Megaphone, Expand } from "lucide-react";
import ShopWeather from "@/components/ShopWeather";
import { defaultShopDashboard, type ShopDashboard } from "@/lib/shop-dashboard";
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
  const format = (options: Intl.DateTimeFormatOptions) => {
    try { return now?.toLocaleString("en-US", { timeZone: data.timezone, ...options }) ?? "—"; }
    catch { return "Check timezone"; }
  };
  return <div className={`shop-screen ${preview ? "shop-preview" : ""}`}>
    <div className="shop-board">
      <header className="shop-brand shop-wood"><div className="shop-emblem"><Trees /></div><div><p>{data.school}</p><h1>{data.title}</h1><small>{data.motto}</small></div><div className="shop-creed"><Hammer /><span>Good work<br />builds<br />good people.</span></div></header>
      <div className="shop-info"><section className="shop-chalk shop-clock"><p>{format({ weekday: "long" })}</p><span>{format({ month: "long", day: "numeric", year: "numeric" })}</span><strong>{format({ hour: "numeric", minute: "2-digit" })}</strong></section><ShopWeather /></div>
      <section className="shop-chalk shop-projects"><h2 className="shop-wood"><Hammer /> Student project spotlight <span>{data.projects.length ? `${slide % data.projects.length + 1} / ${data.projects.length}` : "Made in our shop"}</span></h2><div className="shop-photo">{project ? <img key={project.image} src={project.image} alt={project.title} /> : <div className="shop-empty"><Hammer /><p>Great things are taking shape.</p><span>Project photos will appear here.</span></div>}<div className="shop-caption"><span>CRAFTSMANSHIP IN THE MAKING</span><h3>{project?.title ?? "Our next great project starts here"}</h3></div></div></section>
      <div className="shop-daily"><section className="shop-chalk"><h2 className="shop-wood"><ClipboardList /> Today’s objectives</h2><ul className="shop-objectives">{data.objectives.map((line, i) => <li key={i}><span>□</span>{line}</li>)}</ul></section><section className="shop-chalk shop-safety"><h2 className="shop-wood"><ShieldCheck /> Daily safety tip</h2><div><p>{data.safetyTip}</p><strong>Safety first • Every day</strong></div></section></div>
      <section className="shop-chalk shop-announcements"><h2 className="shop-wood"><Megaphone /> Announcements</h2><div><ul>{data.announcements.map((line, i) => <li key={i}><span>◆</span>{line}</li>)}</ul><p className="shop-signoff">Build skills.<br />Build character.<Trees /></p></div></section>
      <footer className="shop-wood"><Trees />{data.footer}<Trees /></footer>
      {status && <div className="shop-status" role="status">{status}</div>}
    </div>
    {!preview && <button className="shop-fullscreen" title="Enter fullscreen" onClick={() => { void document.documentElement.requestFullscreen().catch(() => setStatus("Use your browser’s fullscreen option.")); }}><Expand size={18} /> Fullscreen</button>}
  </div>;
}
