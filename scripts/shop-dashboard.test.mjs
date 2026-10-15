import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultShopDashboard, validateShopDashboard } from "../lib/shop-dashboard.ts";

test("default board is valid without project photos", () => {
  assert.deepEqual(validateShopDashboard(defaultShopDashboard), defaultShopDashboard);
});
test("accepts uploaded photos and trims titles", () => {
  const result = validateShopDashboard({ ...defaultShopDashboard, projects: [{ title: "  Oak bench  ", image: "data:image/jpeg;base64,YWJj" }] });
  assert.equal(result.projects[0].title, "Oak bench");
});
test("rejects unsafe images, invalid clock settings, and content that overflows", () => {
  for (const patch of [
    { projects: [{ title: "Bench", image: "javascript:alert(1)" }] },
    { projects: [{ title: "Bench", image: "data:image/svg+xml;base64,YWJj" }] },
    { projects: [{ title: "", image: "data:image/jpeg;base64,YWJj" }] },
    { timezone: "not/a/timezone" }, { slideSeconds: 0 }, { slideSeconds: 5.5 },
    { school: " " }, { safetyTip: "a".repeat(241) },
    { objectives: ["1", "2", "3", "4", "5"] }, { announcements: ["a".repeat(111)] },
  ]) assert.throws(() => validateShopDashboard({ ...defaultShopDashboard, ...patch }));
});
test("rejects collections exceeding the hosting request budget", () => {
  const project = { title: "Bench", image: "data:image/jpeg;base64," + "a".repeat(650000) };
  assert.throws(() => validateShopDashboard({ ...defaultShopDashboard, projects: Array(6).fill(project) }), /too large/);
});
