import { createHash } from "node:crypto";
import { ADMIN_AUTH_DISABLED } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const ADMIN_COOKIE = "admin-session";

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function readCookie(request: Request, name: string) {
  const cookieHeader = request.headers.get("cookie") || "";
  for (const item of cookieHeader.split(";")) {
    const [key, ...value] = item.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return "";
}

const openAdminSession = {
  id: "open-admin",
  tokenHash: "open-admin",
  adminId: 0,
  expiresAt: new Date("2099-01-01T00:00:00.000Z"),
  createdAt: new Date(0),
  admin: {
    id: 0,
    email: "open-admin@local",
    name: "Open Admin",
    active: true,
  },
};

export async function getAdminSession(request: Request) {
  if (ADMIN_AUTH_DISABLED) return openAdminSession;

  const token = readCookie(request, ADMIN_COOKIE);
  if (!token) return null;

  const session = await prisma.adminSession.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: {
      admin: {
        select: { id: true, email: true, name: true, active: true },
      },
    },
  });

  if (
    !session ||
    !session.admin.active ||
    session.expiresAt.getTime() <= Date.now()
  ) {
    return null;
  }

  return session;
}

export async function requireAdmin(request: Request) {
  const session = await getAdminSession(request);
  if (!session) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  return null;
}
