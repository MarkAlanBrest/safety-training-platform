export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { resolveDatabaseUrl } from "@/lib/database-url";

export async function GET() {
  const configured = Boolean(resolveDatabaseUrl());
  if (!configured) {
    return Response.json(
      {
        ok: false,
        database: "missing",
        detail: "DATABASE_URL is not configured on this deployment.",
      },
      { status: 503 },
    );
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ ok: true, database: "connected" });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Database connection failed.";
    const quotaExceeded =
      /53000|data transfer quota|exceeded the .* quota|Upgrade your plan to increase limits/i.test(
        detail,
      );
    return Response.json(
      {
        ok: false,
        database: quotaExceeded ? "quota_exceeded" : "error",
        detail: quotaExceeded
          ? "Neon data transfer quota exceeded. Upgrade the Neon plan or wait for the quota to reset."
          : detail,
      },
      { status: 503 },
    );
  }
}
