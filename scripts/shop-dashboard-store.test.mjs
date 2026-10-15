import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm, rmdir, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { defaultShopDashboard } from "../lib/shop-dashboard.ts";
import { readShopDashboard, saveShopDashboard } from "../lib/shop-dashboard-store.ts";

test("JSON storage defaults, persists edits, replaces safely, and reports corruption", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "shop-dashboard-"));
  const file = path.join(directory, "settings.json");
  const previous = process.env.SHOP_DASHBOARD_FILE;
  process.env.SHOP_DASHBOARD_FILE = file;
  try {
    assert.deepEqual(await readShopDashboard(), defaultShopDashboard);
    const content = { ...defaultShopDashboard, title: "Student projects", projects: [{ title: "Oak bench", image: "data:image/jpeg;base64,YWJj" }] };
    await saveShopDashboard(content);
    assert.deepEqual(JSON.parse(await readFile(file, "utf8")), content);
    assert.deepEqual(await readShopDashboard(), content);
    await saveShopDashboard({ ...content, title: "Wood Shop" });
    assert.equal((await readShopDashboard()).title, "Wood Shop");
    await assert.rejects(saveShopDashboard({ ...content, slideSeconds: 0 }));
    assert.equal((await readShopDashboard()).title, "Wood Shop");
    assert.deepEqual(await readdir(directory), ["settings.json"]);
    await writeFile(file, "broken json");
    await assert.rejects(readShopDashboard(), SyntaxError);
    assert.equal(await readFile(file, "utf8"), "broken json");
  } finally {
    if (previous === undefined) delete process.env.SHOP_DASHBOARD_FILE;
    else process.env.SHOP_DASHBOARD_FILE = previous;
    await rm(file, { force: true });
    await rmdir(directory);
  }
});
