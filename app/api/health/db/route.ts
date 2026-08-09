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
    return Response.json(
      {
        ok: false,
        database: "error",
        detail,
      },
      { status: 503 },
    );
  }
}
