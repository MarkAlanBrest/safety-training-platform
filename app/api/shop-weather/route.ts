import { readForecastPeriods } from "@/lib/shop-weather";

export const revalidate = 900;
const headers = { "User-Agent": "HubbardWoodShopDashboard (https://safety-training-platform-eight.vercel.app)", Accept: "application/geo+json" };
async function nws(url: string) {
  // Only follow forecast links hosted by the National Weather Service.
  if (new URL(url).origin !== "https://api.weather.gov") throw new Error("Invalid forecast source.");
  const response = await fetch(url, { headers, next: { revalidate: 900 }, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Weather service returned ${response.status}.`);
  return response.json();
}
export async function GET() {
  try {
    const point = await nws("https://api.weather.gov/points/41.1564,-80.5692");
    const [daily, hourly] = await Promise.all([
      nws(point.properties.forecast), nws(point.properties.forecastHourly),
    ]);
    const periods = readForecastPeriods(daily);
    const hours = readForecastPeriods(hourly);
    return Response.json({ hourly: hours[0], periods: periods.slice(0, 8), updatedAt: daily.properties.updateTime || daily.properties.updated || new Date().toISOString() }, { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=900" } });
  } catch (error) {
    console.error("Hubbard weather fetch failed", error);
    return Response.json({ error: "Weather is temporarily unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
