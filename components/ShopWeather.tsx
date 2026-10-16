"use client";
export default function ShopWeather() {
  return <section className="shop-chalk shop-weather-embed" aria-label="Local weather forecast">
    <iframe src="/shop-weather?compact" title="Hubbard Ohio 44425 weather forecast" />
  </section>;
}
