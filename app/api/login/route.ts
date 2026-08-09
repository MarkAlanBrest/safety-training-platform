export const runtime = "nodejs";

import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ADMIN_COOKIE, hashSessionToken } from "@/lib/admin-session";

async function ensureBootstrapAdmin(email: string, password: string) {
  const bootstrapEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const bootstrapPassword = process.env.ADMIN_PASSWORD;
  if (!bootstrapEmail || !bootstrapPassword) return null;
  if (email !== bootstrapEmail || password !== bootstrapPassword) return null;

  const existingCount = await prisma.adminUser.count();
  if (existingCount > 0) return null;

  const passwordHash = await bcrypt.hash(bootstrapPassword, 12);
  return prisma.adminUser.create({
    data: {
      email: bootstrapEmail,
      passwordHash,
      active: true,
      name: process.env.ADMIN_NAME || "Administrator",
    },
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    let admin = await prisma.adminUser.findUnique({ where: { email } });
    if (!admin) {
      admin = await ensureBootstrapAdmin(email, password);
    }

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
    const detail = error instanceof Error ? error.message : "Unknown database error.";
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: string }).code || "")
        : "";
    const connectionIssue =
      /DATABASE_URL is not configured|connect|connection|ECONNREFUSED|ENOTFOUND|timeout|P100[0-9]|P101[0-7]|Can't reach|password authentication failed|SSL|certificate|ECONNRESET|terminat/i.test(
        `${code} ${detail}`,
      );
    const missingSchema =
      /relation .* does not exist|P2021|table .* does not exist/i.test(`${code} ${detail}`);
    return NextResponse.json(
      {
        error: connectionIssue
          ? "Database connection failed. On Vercel, set DATABASE_URL to your Neon pooled connection string and redeploy."
          : missingSchema
            ? "Database schema is missing. Run npm run db:setup against your production database."
            : "Admin login is temporarily unavailable.",
      },
      { status: 500 },
    );
  }
}
