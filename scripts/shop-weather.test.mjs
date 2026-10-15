import { test } from "node:test";
import assert from "node:assert/strict";
import { readForecastPeriods, weatherSymbol } from "../lib/shop-weather.ts";

test("reads forecast periods and rejects missing or malformed forecast data", () => {
  const period = { name: "Today", startTime: "2026-10-14T12:00:00-04:00", endTime: "2026-10-14T18:00:00-04:00", isDaytime: true, temperature: 65, temperatureUnit: "F", shortForecast: "Partly Sunny" };
  assert.deepEqual(readForecastPeriods({ properties: { periods: [period] } }), [period]);
  for (const value of [null, {}, { properties: { periods: [] } }, { properties: { periods: [{ ...period, temperature: null }] } }]) assert.throws(() => readForecastPeriods(value));
});
test("uses the more significant weather condition for mixed forecasts", () => {
  assert.equal(weatherSymbol("Partly Sunny then Showers And Thunderstorms"), "⛈");
  assert.equal(weatherSymbol("Rain And Snow"), "❄");
  assert.equal(weatherSymbol("Mostly Cloudy"), "☁");
});
