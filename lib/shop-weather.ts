export type ForecastPeriod = {
  name: string; startTime: string; endTime: string; isDaytime: boolean;
  temperature: number; temperatureUnit: string; shortForecast: string;
};
export type ShopWeatherData = { hourly: ForecastPeriod; periods: ForecastPeriod[]; updatedAt: string };

export function readForecastPeriods(value: unknown): ForecastPeriod[] {
  const periods = (value as { properties?: { periods?: unknown } })?.properties?.periods;
  if (!Array.isArray(periods) || !periods.length) throw new Error("Forecast is unavailable.");
  for (const period of periods) {
    if (!period || typeof period.name !== "string" || typeof period.shortForecast !== "string" || !Number.isFinite(period.temperature) || !["F", "C"].includes(period.temperatureUnit) || typeof period.isDaytime !== "boolean" || !Number.isFinite(Date.parse(period.startTime)) || !Number.isFinite(Date.parse(period.endTime))) throw new Error("Invalid forecast response.");
  }
  return periods;
}

export function weatherSymbol(forecast: string): string {
  if (/thunder/i.test(forecast)) return "⛈";
  if (/snow|sleet|ice|freezing/i.test(forecast)) return "❄";
  if (/rain|shower|drizzle/i.test(forecast)) return "🌧";
  if (/fog|haze/i.test(forecast)) return "🌫";
  if (/partly|mostly sunny/i.test(forecast)) return "🌤";
  if (/cloud|overcast/i.test(forecast)) return "☁";
  return "☀";
}
