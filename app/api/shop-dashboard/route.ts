import { readShopDashboard } from "@/lib/shop-dashboard-store";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return Response.json(await readShopDashboard(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Dashboard read failed", error);
    return Response.json({ error: "Could not read dashboard settings. Check the JSON file and server file permissions." }, { status: 503 });
  }
}
