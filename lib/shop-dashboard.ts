export type ShopProject = { title: string; image: string };
export const SHOP_CLEANUP_CATEGORIES = ["tools", "tables", "floors", "backRoom"] as const;
export type ShopCleanupCategory = typeof SHOP_CLEANUP_CATEGORIES[number];
export type ShopAlarm = {
  time: string; message: string; durationMinutes: number; days: number[]; enabled: boolean;
  students: string[]; cleanupTasks: Record<ShopCleanupCategory, string>;
};
export type ShopDashboard = {
  school: string; title: string; motto: string; footer: string;
  timezone: string; slideSeconds: number;
  notesTitle: string; notes: string; projects: ShopProject[];
  weather: string;
  weatherEmbedUrl?: string;
  alarms: ShopAlarm[];
};

export const defaultShopDashboard: ShopDashboard = {
  school: "Hubbard High School", title: "Wood Shop",
  motto: "Create  •  Build  •  Learn  •  Respect",
  footer: "Hubbard Carpentry Program", timezone: "America/New_York",
  slideSeconds: 12, weather: "Add today’s forecast in the dashboard editor.",
  notesTitle: "Shop notes",
  notes: "Complete your safety test before operating equipment.\nAlways keep your hands away from the blade and use a push stick when cutting small pieces.\nReturn all tools to their proper place and keep work areas clean.\nGreat job on the new benches!",
  projects: [], weatherEmbedUrl: "", alarms: [],
};

export const shopCleanupCategoryLabels: Record<ShopCleanupCategory, string> = {
  tools: "Tools", tables: "Tables", floors: "Floors", backRoom: "Back Room",
};

const emptyCleanupTasks = (): Record<ShopCleanupCategory, string> => ({
  tools: "", tables: "", floors: "", backRoom: "",
});

export function parseWeatherEmbed(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  const source = trimmed.startsWith("<") ? trimmed.match(/<iframe\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i)?.[1] : trimmed;
  if (!source || source.length > 3000) throw new Error("Paste a meteoblue widget URL or its iframe embed code.");
  const decoded = source.replace(/&amp;/g, "&");
  let url: URL;
  try { url = new URL(decoded); } catch { throw new Error("Invalid weather widget URL."); }
  if (url.origin !== "https://www.meteoblue.com" || url.username || url.password || !/^\/en\/weather\/widget\/(daily|three)\/[^/]+$/.test(url.pathname)) throw new Error("Use an HTTPS daily or 3-hour weather widget from www.meteoblue.com.");
  return decoded;
}

export function validateShopDashboard(value: unknown): ShopDashboard {
  if (!value || typeof value !== "object") throw new Error("Invalid dashboard.");
  const v = value as Record<string, unknown>;
  const str = (key: string, max: number) => {
    if (typeof v[key] !== "string" || (v[key] as string).length > max) throw new Error(`Invalid ${key} (maximum ${max} characters).`);
    return (v[key] as string).trim();
  };
  const timezone = str("timezone", 80);
  try { new Intl.DateTimeFormat("en-US", { timeZone: timezone }); } catch { throw new Error("Enter a valid timezone, such as America/New_York."); }
  if (!Number.isInteger(v.slideSeconds) || Number(v.slideSeconds) < 5 || Number(v.slideSeconds) > 120) throw new Error("Slide duration must be 5–120 seconds.");
  if (!Array.isArray(v.projects) || v.projects.length > 12) throw new Error("Use up to 12 project photos.");
  const projects = v.projects.map((p: unknown) => {
    if (!p || typeof p !== "object") throw new Error("Invalid project.");
    const { title, image } = p as ShopProject;
    if (typeof title !== "string" || !title.trim() || title.length > 80 || typeof image !== "string" || image.length > 700000 || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image)) throw new Error("Each project needs a title (up to 80 characters) and an uploaded image.");
    return { title: title.trim(), image };
  });
  if (projects.reduce((total, project) => total + project.image.length, 0) > 3800000) throw new Error("The photo collection is too large. Remove some photos or upload smaller images.");
  const school = str("school", 60), title = str("title", 30);
  if (!school || !title) throw new Error("School and dashboard title are required.");
  if (v.weatherEmbedUrl !== undefined && typeof v.weatherEmbedUrl !== "string") throw new Error("Invalid weather widget URL.");
  const weatherEmbedUrl = parseWeatherEmbed((v.weatherEmbedUrl as string | undefined) ?? "");
  const alarms = validateShopAlarms(v.alarms);
  const notesTitle = v.notesTitle === undefined ? defaultShopDashboard.notesTitle : str("notesTitle", 40);
  const notes = v.notes === undefined ? legacyNotes(v) : str("notes", 600);
  return { school, title, motto: str("motto", 80), footer: str("footer", 80), timezone, slideSeconds: Number(v.slideSeconds), weather: str("weather", 120), weatherEmbedUrl, notesTitle, notes, projects, alarms };
}

// Boards saved before the single notes box kept objectives, a safety tip, and announcements separately.
function legacyNotes(v: Record<string, unknown>): string {
  const lines = [v.objectives, v.safetyTip, v.announcements].flat().filter((s): s is string => typeof s === "string" && !!s.trim());
  return lines.length ? lines.map(s => s.trim()).join("\n").slice(0, 600) : defaultShopDashboard.notes;
}

function validateShopAlarms(value: unknown): ShopAlarm[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 30) throw new Error("Use up to 30 scheduled announcements.");
  return value.map((item: unknown) => {
    if (!item || typeof item !== "object") throw new Error("Invalid scheduled announcement.");
    const a = item as ShopAlarm;
    if (typeof a.time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(a.time)) throw new Error("Choose a valid announcement time.");
    if (typeof a.message !== "string" || !a.message.trim() || a.message.length > 240) throw new Error("Each announcement needs a message of up to 240 characters.");
    if (!Number.isInteger(a.durationMinutes) || a.durationMinutes < 1 || a.durationMinutes > 30) throw new Error("Announcement duration must be 1–30 minutes.");
    if (typeof a.enabled !== "boolean" || !Array.isArray(a.days) || !a.days.length || a.days.length > 7 || a.days.some(day => !Number.isInteger(day) || day < 0 || day > 6)) throw new Error("Choose at least one day for each announcement.");
    const students = a.students === undefined ? [] : a.students;
    if (!Array.isArray(students) || students.length > 60 || students.some(student => typeof student !== "string" || !student.trim() || student.length > 80)) throw new Error("Each announcement can have up to 60 students. Student names must be 1–80 characters.");
    const normalizedStudents = students.map(student => student.trim());
    if (new Set(normalizedStudents.map(student => student.toLocaleLowerCase())).size !== normalizedStudents.length) throw new Error("Remove duplicate student names from each announcement.");
    const cleanupTasks = a.cleanupTasks === undefined ? emptyCleanupTasks() : a.cleanupTasks;
    if (!cleanupTasks || typeof cleanupTasks !== "object" || Array.isArray(cleanupTasks)) throw new Error("Invalid cleanup task descriptions.");
    const tasks = Object.fromEntries(SHOP_CLEANUP_CATEGORIES.map(category => {
      const task = cleanupTasks[category];
      if (task === undefined) return [category, ""];
      if (typeof task !== "string" || task.length > 400) throw new Error("Cleanup task descriptions must be 400 characters or less.");
      return [category, task.trim()];
    })) as Record<ShopCleanupCategory, string>;
    return { time: a.time, message: a.message.trim(), durationMinutes: a.durationMinutes, enabled: a.enabled, days: [...new Set(a.days)], students: normalizedStudents, cleanupTasks: tasks };
  });
}

export function assignCleanupStudents(alarm: ShopAlarm, seed: string): Record<ShopCleanupCategory, string[]> {
  let state = 2166136261;
  for (let i = 0; i < seed.length; i++) state = Math.imul(state ^ seed.charCodeAt(i), 16777619);
  const random = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
  const result: Record<ShopCleanupCategory, string[]> = { tools: [], tables: [], floors: [], backRoom: [] };
  const students = [...alarm.students];
  for (let i = students.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [students[i], students[j]] = [students[j], students[i]];
  }
  for (const student of students) {
    const available = SHOP_CLEANUP_CATEGORIES.filter(category => category !== "backRoom" || result.backRoom.length < 2);
    const smallest = Math.min(...available.map(category => result[category].length));
    const leastFilled = available.filter(category => result[category].length === smallest);
    result[leastFilled[Math.floor(random() * leastFilled.length)]].push(student);
  }
  return result;
}

export function shopDateKey(now: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (name: string) => parts.find(value => value.type === name)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

// Use the board's wall clock; the latest scheduled start wins when windows overlap.
export function activeShopAlarm(alarms: ShopAlarm[], now: Date, timezone: string): ShopAlarm | null {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(now);
  } catch { return null; } // The editor can temporarily contain an incomplete timezone.
  const part = (name: string) => Number(parts.find(p => p.type === name)?.value);
  const day = new Date(Date.UTC(part("year"), part("month") - 1, part("day"))).getUTCDay();
  const seconds = part("hour") * 3600 + part("minute") * 60 + part("second");
  let result: ShopAlarm | null = null, smallestElapsed = Infinity;
  for (const alarm of alarms) {
    if (!alarm.enabled) continue;
    const [hour, minute] = alarm.time.split(":").map(Number);
    const elapsed = (seconds - hour * 3600 - minute * 60 + 86400) % 86400;
    const startDay = seconds < hour * 3600 + minute * 60 ? (day + 6) % 7 : day;
    if (alarm.days.includes(startDay) && elapsed < alarm.durationMinutes * 60 && elapsed < smallestElapsed) {
      result = alarm; smallestElapsed = elapsed;
    }
  }
  return result;
}
