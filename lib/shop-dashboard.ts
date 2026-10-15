export type ShopProject = { title: string; image: string };
export type ShopDashboard = {
  school: string; title: string; motto: string; footer: string;
  timezone: string; slideSeconds: number; objectives: string[];
  safetyTip: string; announcements: string[]; projects: ShopProject[];
  weather: string;
  weatherEmbedUrl?: string;
};

export const defaultShopDashboard: ShopDashboard = {
  school: "Hubbard High School", title: "Wood Shop",
  motto: "Create  •  Build  •  Learn  •  Respect",
  footer: "Hubbard Carpentry Program", timezone: "America/New_York",
  slideSeconds: 12, weather: "Add today’s forecast in the dashboard editor.",
  objectives: ["Review power tool safety", "Complete project measurements", "Continue shop projects", "Clean and organize workstations"],
  safetyTip: "Always keep your hands away from the blade and use a push stick when cutting small pieces.",
  announcements: ["Complete your safety test before operating equipment.", "Return all tools to their proper place.", "Keep work areas clean.", "Great job on the new benches!"],
  projects: [], weatherEmbedUrl: "",
};

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
  const lines = (key: string, max: number) => {
    if (!Array.isArray(v[key]) || v[key].length > max || v[key].some((s: unknown) => typeof s !== "string" || s.length > 110)) throw new Error(`${key}: use up to ${max} lines of 110 characters.`);
    return (v[key] as string[]).map(s => s.trim()).filter(Boolean);
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
  return { school, title, motto: str("motto", 80), footer: str("footer", 80), timezone, slideSeconds: Number(v.slideSeconds), weather: str("weather", 120), weatherEmbedUrl, objectives: lines("objectives", 4), safetyTip: str("safetyTip", 240), announcements: lines("announcements", 4), projects };
}
