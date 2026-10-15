import { readShopDashboard } from "@/lib/shop-dashboard-store";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return Response.json(await readShopDashboard(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Dashboard read failed", error);
    return Response.json({ error: "Could not load dashboard settings from the database. Check DATABASE_URL and run npm run db:shop-dashboard." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
