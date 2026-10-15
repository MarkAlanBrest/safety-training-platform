import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultShopDashboard } from "../lib/shop-dashboard.ts";
import { createShopDashboardStore } from "../lib/shop-dashboard-persistence.ts";

test("database store saves the complete JSON record and reloads across instances", async () => {
  let persisted = null;
  const repository = {
    async read() { return persisted === null ? null : JSON.parse(persisted); },
    async write(content) { persisted = JSON.stringify(content); },
  };
  const editor = createShopDashboardStore(repository);
  const defaults = await editor.read();
  assert.deepEqual(defaults, defaultShopDashboard);
  defaults.title = "Changed locally";
  assert.equal((await editor.read()).title, defaultShopDashboard.title);
  const content = { ...defaultShopDashboard, title: "Student projects", projects: [{ title: "Oak bench", image: "data:image/jpeg;base64,YWJj" }] };
  await editor.save(content);
  const tv = createShopDashboardStore(repository);
  assert.deepEqual(await tv.read(), content);
  await editor.save({ ...content, title: "Wood Shop" });
  assert.equal((await tv.read()).title, "Wood Shop");
  await assert.rejects(editor.save({ ...content, slideSeconds: 0 }));
  assert.equal((await tv.read()).title, "Wood Shop");
});

test("database failures propagate instead of reporting a successful save or default board", async () => {
  const store = createShopDashboardStore({
    async read() { throw new Error("Database unavailable"); },
    async write() { throw new Error("Database unavailable"); },
  });
  await assert.rejects(store.save(defaultShopDashboard), /Database unavailable/);
  await assert.rejects(store.read(), /Database unavailable/);
});

test("invalid stored data is reported rather than silently reset", async () => {
  const store = createShopDashboardStore({ async read() { return { title: "Incomplete" }; }, async write() {} });
  await assert.rejects(store.read());
});
