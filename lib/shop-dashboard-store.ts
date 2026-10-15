import { prisma } from "@/lib/prisma";
import { createShopDashboardStore } from "./shop-dashboard-persistence.ts";

const store = createShopDashboardStore({
  async read() {
    const record = await prisma.shopDashboard.findUnique({ where: { id: "main" } });
    return record?.content ?? null;
  },
  async write(content) {
    await prisma.shopDashboard.upsert({
      where: { id: "main" },
      create: { id: "main", content },
      update: { content },
    });
  },
});

export const readShopDashboard = store.read;
export const saveShopDashboard = store.save;
