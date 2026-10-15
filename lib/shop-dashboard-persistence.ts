import { defaultShopDashboard, validateShopDashboard, type ShopDashboard } from "./shop-dashboard.ts";

type DashboardRepository = {
  read(): Promise<unknown | null>;
  write(content: ShopDashboard): Promise<void>;
};

export function createShopDashboardStore(repository: DashboardRepository) {
  return {
    async read(): Promise<ShopDashboard> {
      const content = await repository.read();
      return content === null ? structuredClone(defaultShopDashboard) : validateShopDashboard(content);
    },
    async save(value: unknown): Promise<void> {
      await repository.write(validateShopDashboard(value));
    },
  };
}
