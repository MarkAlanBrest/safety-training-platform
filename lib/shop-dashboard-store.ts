import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { defaultShopDashboard, validateShopDashboard, type ShopDashboard } from "./shop-dashboard.ts";

function settingsPath() {
  return process.env.SHOP_DASHBOARD_FILE || path.join(process.cwd(), "data", "shop-dashboard.json");
}

export async function readShopDashboard(): Promise<ShopDashboard> {
  let text: string;
  try {
    text = await readFile(settingsPath(), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return structuredClone(defaultShopDashboard);
    throw error;
  }
  return validateShopDashboard(JSON.parse(text));
}

export async function saveShopDashboard(value: unknown): Promise<void> {
  const content = validateShopDashboard(value);
  const target = settingsPath();
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(content, null, 2) + "\n", { flag: "wx" });
    // Readers see either the previous complete file or the new complete file.
    await rename(temporary, target);
  } finally {
    await rm(temporary, { force: true });
  }
}
