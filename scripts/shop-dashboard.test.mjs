import { test } from "node:test";
import assert from "node:assert/strict";
import { assignCleanupStudents, defaultShopDashboard, validateShopDashboard, parseWeatherEmbed, activeShopAlarm } from "../lib/shop-dashboard.ts";

test("weather embeds extract the iframe URL without executing surrounding HTML", () => {
  const url = "https://www.meteoblue.com/en/weather/widget/daily/example_123?days=3&layout=dark";
  assert.equal(parseWeatherEmbed(`<iframe src="${url.replaceAll("&", "&amp;")}"></iframe><script>alert(1)</script>`), url);
  assert.equal(validateShopDashboard({ ...defaultShopDashboard, weatherEmbedUrl: url }).weatherEmbedUrl, url);
  assert.equal(parseWeatherEmbed(""), "");
  const legacy = { ...defaultShopDashboard }; delete legacy.weatherEmbedUrl;
  assert.equal(validateShopDashboard(legacy).weatherEmbedUrl, "");
});
test("weather embeds reject scripts, unrelated pages, and impersonated hosts", () => {
  for (const url of ["javascript:alert(1)", "https://www.meteoblue.com.evil.test/en/weather/widget/daily/x", "https://www.meteoblue.com/en/weather/week/x", "http://www.meteoblue.com/en/weather/widget/daily/x", "<script src='https://www.meteoblue.com/en/weather/widget/daily/x'></script>"]) assert.throws(() => parseWeatherEmbed(url));
});

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
    { school: " " }, { notes: "a".repeat(601) }, { notes: 5 }, { notesTitle: "a".repeat(41) },
  ]) assert.throws(() => validateShopDashboard({ ...defaultShopDashboard, ...patch }));
});
test("boards saved with separate objectives, tip, and announcements keep that text in the notes box", () => {
  const legacy = { ...defaultShopDashboard, objectives: ["Measure twice"], safetyTip: " Wear goggles ", announcements: ["Bench sale Friday"] };
  delete legacy.notes; delete legacy.notesTitle;
  const result = validateShopDashboard(legacy);
  assert.equal(result.notes, "Measure twice\nWear goggles\nBench sale Friday");
  assert.equal(result.notesTitle, defaultShopDashboard.notesTitle);
  assert.equal("objectives" in result, false);
});
test("rejects collections exceeding the hosting request budget", () => {
  const project = { title: "Bench", image: "data:image/jpeg;base64," + "a".repeat(650000) };
  assert.throws(() => validateShopDashboard({ ...defaultShopDashboard, projects: Array(6).fill(project) }), /too large/);
});

test("scheduled announcements validate and old boards have an empty schedule", () => {
  const legacy = { ...defaultShopDashboard }; delete legacy.alarms;
  assert.deepEqual(validateShopDashboard(legacy).alarms, []);
  const oldAlarm = validateShopDashboard({ ...defaultShopDashboard, alarms: [alarm] }).alarms[0];
  assert.deepEqual(oldAlarm.students, []);
  assert.deepEqual(oldAlarm.cleanupTasks, { tools: "", tables: "", floors: "", backRoom: "" });
  for (const patch of [{ time: "25:00" }, { message: " " }, { durationMinutes: 0 }, { durationMinutes: 1.5 }, { days: [] }, { days: [7] }, { enabled: "yes" }]) {
    assert.throws(() => validateShopDashboard({ ...defaultShopDashboard, alarms: [{ ...alarm, ...patch }] }));
  }
  for (const patch of [{ students: ["Sam", " sam "] }, { students: [5] }, { students: Array(61).fill("Student") }, { cleanupTasks: { tools: "x".repeat(401) } }]) {
    assert.throws(() => validateShopDashboard({ ...defaultShopDashboard, alarms: [{ ...alarm, ...patch }] }));
  }
  assert.equal(validateShopDashboard({ ...defaultShopDashboard, alarms: Array(7).fill(alarm) }).alarms.length, 7);
});

const alarm = { time: "14:00", message: "Time For Clean Up", durationMinutes: 3, days: [1, 2, 3, 4, 5], enabled: true };
test("cleanup assignments are stable, include every student once, and cap the back room at two", () => {
  const students = Array.from({ length: 37 }, (_, index) => `Student ${index + 1}`);
  const cleanupAlarm = validateShopDashboard({ ...defaultShopDashboard, alarms: [{ ...alarm, students }] }).alarms[0];
  const first = assignCleanupStudents(cleanupAlarm, "2026-10-20:14:00:0");
  const repeated = assignCleanupStudents(cleanupAlarm, "2026-10-20:14:00:0");
  assert.deepEqual(repeated, first);
  assert.ok(first.backRoom.length <= 2);
  assert.deepEqual(Object.values(first).flat().sort(), [...students].sort());
});
test("student lists preserve new lines while editing and discard blank lines when saved", () => {
  const legacy = { ...defaultShopDashboard, alarms: [{ ...alarm, students: ["  Sam ", "", " Taylor  ", ""] }] };
  const saved = validateShopDashboard(legacy).alarms[0];
  assert.deepEqual(saved.students, ["Sam", "Taylor"]);
  assert.deepEqual(Object.values(assignCleanupStudents(legacy.alarms[0], "seed")).flat().sort(), ["Sam", "Taylor"]);
});
test("announcements follow the board timezone and end precisely after three minutes", () => {
  const active = iso => activeShopAlarm([alarm], new Date(iso), "America/New_York");
  assert.equal(active("2026-10-15T17:59:59Z"), null);
  assert.equal(active("2026-10-15T18:00:00Z"), alarm);
  assert.equal(active("2026-10-15T18:02:59Z"), alarm);
  assert.equal(active("2026-10-15T18:03:00Z"), null);
  assert.equal(active("2026-10-17T18:00:00Z"), null);
  assert.equal(activeShopAlarm([{ ...alarm, enabled: false }], new Date("2026-10-15T18:00:00Z"), "America/New_York"), null);
});
test("announcements cross midnight and latest start wins overlaps", () => {
  const midnight = { ...alarm, time: "23:59", days: [4] };
  assert.equal(activeShopAlarm([midnight], new Date("2026-10-16T04:01:00Z"), "America/New_York"), midnight);
  assert.equal(activeShopAlarm([midnight], new Date("2026-10-16T04:02:00Z"), "America/New_York"), null);
  const later = { ...alarm, time: "14:01" };
  assert.equal(activeShopAlarm([alarm, later], new Date("2026-10-15T18:01:30Z"), "America/New_York"), later);
});
