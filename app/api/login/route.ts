export const runtime = "nodejs";

import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ADMIN_COOKIE, hashSessionToken } from "@/lib/admin-session";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    const admin = await prisma.adminUser.findUnique({ where: { email } });
    if (!admin || !admin.active || !(await bcrypt.compare(password, admin.passwordHash))) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 },
      );
    }

    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);

    await prisma.adminSession.deleteMany({
      where: { expiresAt: { lte: new Date() } },
    });
    await prisma.adminSession.create({
      data: {
        tokenHash: hashSessionToken(token),
        adminId: admin.id,
        expiresAt,
      },
    });

    const response = NextResponse.json({ ok: true });
    response.cookies.set(ADMIN_COOKIE, token, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      expires: expiresAt,
    });
    return response;
  } catch (error) {
    console.error("Admin login failed:", error);
    return NextResponse.json(
      { error: "Admin login is temporarily unavailable." },
      { status: 500 },
    );
  }
}
