import ShopWeatherView from "./ShopWeatherView";

export default async function ShopWeatherPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { compact } = await searchParams;
  return <ShopWeatherView compact={compact !== undefined} />;
}
