"use client";
import { useEffect, useState } from "react";
import { weatherSymbol, type ShopWeatherData } from "@/lib/shop-weather";
import "./weather.css";

export default function ShopWeatherPage() {
  const [data, setData] = useState<ShopWeatherData | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    async function refresh() {
      try {
        const response = await fetch("/api/shop-weather", { signal: controller.signal });
        if (!response.ok) throw new Error();
        const next = await response.json();
        if (alive) { setData(next); setFailed(false); }
      } catch { if (alive) setFailed(true); }
    }
    void refresh();
    const timer = setInterval(refresh, 15 * 60 * 1000);
    return () => { alive = false; controller.abort(); clearInterval(timer); };
  }, []);
  const forecastLink = "https://forecast.weather.gov/MapClick.php?lat=41.1564&lon=-80.5692";
  const future = data?.periods.filter(p => p.isDaytime).slice(0, 3) ?? [];
  return <main className="hubbard-weather">
    <header>Hubbard, Ohio <span>44425</span></header>
    {data ? <><section className="hubbard-current"><span className="hubbard-weather-symbol" aria-hidden="true">{weatherSymbol(data.hourly.shortForecast)}</span><div><small>This hour’s forecast</small><strong>{Math.round(data.hourly.temperature)}°{data.hourly.temperatureUnit}</strong><p>{data.hourly.shortForecast}</p></div></section><section className="hubbard-forecast" aria-label="Upcoming daytime forecasts">{future.map(p => <div key={p.startTime}><span>{p.name}</span><span className="hubbard-small-symbol" aria-hidden="true">{weatherSymbol(p.shortForecast)}</span><strong>{p.temperature}°{p.temperatureUnit}</strong><small>{p.shortForecast}</small></div>)}</section></> : <p className="hubbard-weather-loading" role="status">{failed ? "Weather temporarily unavailable. Retrying automatically." : "Loading local forecast…"}</p>}
    <footer><a href={forecastLink} target="_blank" rel="noreferrer">National Weather Service ↗</a><span>{failed ? "Connection lost · showing last forecast" : data ? `Issued ${new Date(data.updatedAt).toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" })}` : "Updates every 15 minutes"}</span></footer>
  </main>;
}
