"use client";
import { useEffect, useState, type ChangeEvent } from "react";
import ShopDisplay from "@/components/ShopDisplay";
import { defaultShopDashboard, validateShopDashboard, type ShopDashboard } from "@/lib/shop-dashboard";
import "./editor.css";

async function resizePhoto(file: File): Promise<string> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Choose a JPG, PNG, or WebP photo.");
  if (file.size > 20000000) throw new Error("Choose a photo smaller than 20 MB.");
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Your browser could not process the photo.");
    context.fillStyle = "#ffffff"; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const result = canvas.toDataURL("image/jpeg", .78);
    if (result.length > 700000) throw new Error("This photo is too detailed. Try a smaller image.");
    return result;
  } finally { bitmap.close(); }
}

export default function ShopEditor() {
  const [draft, setDraft] = useState<ShopDashboard>(defaultShopDashboard);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function load() {
    setError("");
    try {
      const response = await fetch("/api/shop-dashboard", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setDraft({ ...data, alarms: data.alarms ?? [] }); setLoaded(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load dashboard."); }
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function update<K extends keyof ShopDashboard>(key: K, value: ShopDashboard[K]) {
    setDraft(d => ({ ...d, [key]: value })); setDirty(true); setMessage("");
  }
  async function save() {
    setBusy(true); setError(""); setMessage("");
    try {
      const content = validateShopDashboard(draft);
      const response = await fetch("/api/admin/shop-dashboard", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(content) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Save failed.");
      setDraft(content); setDirty(false); setMessage("Saved. The TV will update within 15 seconds.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save."); }
    finally { setBusy(false); }
  }
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []); event.target.value = "";
    if (!files.length) return;
    setBusy(true); setError("");
    try {
      if (draft.projects.length + files.length > 12) throw new Error("Use up to 12 project photos.");
      const photos = [];
      for (const file of files) photos.push({ title: file.name.replace(/\.[^.]+$/, "").slice(0, 80), image: await resizePhoto(file) });
      update("projects", [...draft.projects, ...photos]);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not upload photos."); }
    finally { setBusy(false); }
  }
  function move(index: number, offset: number) {
    const projects = [...draft.projects];
    [projects[index], projects[index + offset]] = [projects[index + offset], projects[index]];
    update("projects", projects);
  }
  const textField = (key: "school" | "title" | "motto" | "footer" | "timezone" | "weather" | "notesTitle", label: string, max: number) => <label>{label}<input value={draft[key]} maxLength={max} onChange={e => update(key, e.target.value)} /></label>;
  return <main className="shop-editor-shell"><header className="shop-editor-header"><div><p>WOOD SHOP • DIGITAL SIGNAGE</p><h1>TV dashboard editor</h1></div><a className="shop-editor-link" href="/shop-display" target="_blank" rel="noreferrer">Open TV display ↗</a></header>
    <div className="shop-editor-intro"><p>Edit the board here, then save to update the portrait TV. Photos rotate automatically. The preview shows your unsaved changes.</p><button disabled={!loaded || busy || !dirty} onClick={save}>{busy ? "Working…" : "Save to TV"}</button></div>
    {error && <p className="shop-editor-error" role="alert">{error} {!loaded && <button onClick={load}>Retry loading</button>}</p>}
    <p role="status" className="shop-editor-status">{message || (dirty ? "Unsaved changes" : loaded ? "Ready to edit" : "Loading saved content…")}</p>
    <div className="shop-editor-layout"><fieldset disabled={!loaded || busy} className="shop-editor-fields">
      <section><h2>Board identity</h2>{textField("school", "School name", 60)}{textField("title", "Board title", 30)}{textField("motto", "Motto", 80)}{textField("footer", "Footer", 80)}{textField("timezone", "Clock timezone", 80)}<small>Use an IANA timezone, such as America/New_York.</small></section>
      <section><h2>Scheduled announcements</h2><p>Show a message over the board, then automatically return to the regular screen. Times use {draft.timezone}. Keep the display open for announcements to appear. If times overlap, the most recent announcement takes priority.</p>
        {draft.alarms.map((alarm, index) => {
          const change = (patch: Partial<typeof alarm>) => update("alarms", draft.alarms.map((a, i) => i === index ? { ...a, ...patch } : a));
          return <div className="shop-alarm-edit" key={index}><h3>Announcement {index + 1}</h3>
            <label><input type="checkbox" checked={alarm.enabled} onChange={e => change({ enabled: e.target.checked })} /> Enabled</label>
            <label>Time<input type="time" value={alarm.time} onChange={e => change({ time: e.target.value })} /></label>
            <label>Message<textarea rows={3} maxLength={240} value={alarm.message} onChange={e => change({ message: e.target.value })} /></label>
            <label>Display for (minutes)<input type="number" min={1} max={30} value={alarm.durationMinutes} onChange={e => change({ durationMinutes: Number(e.target.value) })} /></label>
            <div role="group" aria-label={`Days for announcement ${index + 1}`} className="shop-alarm-days">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, value) => <label key={day}><input type="checkbox" checked={alarm.days.includes(value)} onChange={e => change({ days: e.target.checked ? [...alarm.days, value] : alarm.days.filter(d => d !== value) })} />{day}</label>)}</div>
            <button onClick={() => update("alarms", draft.alarms.filter((_, i) => i !== index))}>Remove announcement {index + 1}</button>
          </div>;
        })}
        <button disabled={draft.alarms.length >= 30} onClick={() => update("alarms", [...draft.alarms, { time: "14:00", message: "Time For Clean Up", durationMinutes: 3, days: [1, 2, 3, 4, 5], enabled: true }])}>Add scheduled announcement</button>
        <small>Up to 30 announcements. New announcements default to weekdays and three minutes. Save to TV to apply your schedule.</small>
      </section>
      <section><h2>Weather for Hubbard, OH 44425</h2><p>The board embeds its own weather webpage with National Weather Service forecasts. It updates every 15 minutes automatically.</p><p><a href="/shop-weather" target="_blank" rel="noreferrer">Open the weather webpage</a></p></section>
      <section><h2>Student project spotlight</h2><p>Add up to 12 photos. Images are resized automatically and stored with the board.</p><label>Seconds per photo<input type="number" min={5} max={120} value={draft.slideSeconds} onChange={e => update("slideSeconds", Number(e.target.value))} /></label><label className="shop-upload">Add project photos<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={upload} /></label>
        {draft.projects.map((project, index) => <div className="shop-project-edit" key={index}><img src={project.image} alt={`Project ${index + 1}`} /><div><label>Project {index + 1} title<input maxLength={80} value={project.title} onChange={e => update("projects", draft.projects.map((p, i) => i === index ? { ...p, title: e.target.value } : p))} /></label><div className="shop-project-buttons"><button disabled={index === 0} onClick={() => move(index, -1)} aria-label={`Move project ${index + 1} earlier`}>↑</button><button disabled={index === draft.projects.length - 1} onClick={() => move(index, 1)} aria-label={`Move project ${index + 1} later`}>↓</button><button onClick={() => update("projects", draft.projects.filter((_, i) => i !== index))}>Remove</button></div></div></div>)}
      </section>
      <section><h2>Message box</h2>{textField("notesTitle", "Box heading", 40)}<label>Message · type anything; line breaks show on the TV<textarea rows={8} maxLength={600} value={draft.notes} onChange={e => update("notes", e.target.value)} /></label><small>Up to 600 characters. Check the preview to make sure everything fits.</small></section>
    </fieldset><aside className="shop-editor-preview"><h2>Portrait TV preview · 9:16</h2><ShopDisplay preview={draft} /><p>On the TV, open /shop-display, set the screen orientation to portrait, and choose Fullscreen.</p></aside></div>
  </main>;
}
