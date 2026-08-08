import "dotenv/config";
import bcrypt from "bcryptjs";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";
import ws from "ws";

const email = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const password = String(process.env.ADMIN_PASSWORD || "");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not configured.");
}

if (!email || !password) {
  console.log("Skipping admin bootstrap: set ADMIN_EMAIL and ADMIN_PASSWORD to create an admin user.");
  process.exit(0);
}

neonConfig.webSocketConstructor = ws;
neonConfig.webSocketConstructor = ws;
const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }),
});

try {
  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await prisma.adminUser.upsert({
    where: { email },
    update: {
      passwordHash,
      active: true,
      name: process.env.ADMIN_NAME || "Administrator",
    },
    create: {
      email,
      passwordHash,
      active: true,
      name: process.env.ADMIN_NAME || "Administrator",
    },
  });

  console.log(`Admin ready: ${admin.email}`);
} finally {
  await prisma.$disconnect();
}
