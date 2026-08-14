export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";

export async function DELETE(request: Request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  const url = new URL(request.url);
  const id = Number(url.searchParams.get("id") || 0);
  if (!id) {
    return NextResponse.json({ error: "Message id is required." }, { status: 400 });
  }

  await prisma.courseAlertMessage.update({
    where: { id },
    data: { active: false },
  });

  return NextResponse.json({ ok: true });
}
