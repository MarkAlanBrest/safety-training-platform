import { requireAdmin } from "@/lib/admin-session";
import { saveShopDashboard } from "@/lib/shop-dashboard-store";
import { validateShopDashboard } from "@/lib/shop-dashboard";
export const runtime = "nodejs";
export async function PUT(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "Invalid origin." }, { status: 403 });
  let content;
  try {
    const body = await request.text();
    if (body.length > 8500000) throw new Error("Photos are too large. Use fewer or smaller photos.");
    content = validateShopDashboard(JSON.parse(body));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Invalid content." }, { status: 400 });
  }
  try {
    await saveShopDashboard(content);
    return Response.json({ saved: true });
  } catch (error) {
    console.error("Dashboard save failed", error);
    return Response.json({ error: "Could not save settings to the database. Check DATABASE_URL and run npm run db:shop-dashboard." }, { status: 503 });
  }
}
