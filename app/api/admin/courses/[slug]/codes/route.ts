export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-session";

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomChunk(length: number) {
  return Array.from(
    { length },
    () => alphabet[randomInt(0, alphabet.length)],
  ).join("");
}

function createCode(slug: string) {
  const prefix = slug.replace(/[^a-z0-9]/gi, "").slice(0, 3).toUpperCase() || "TRN";
  return `${prefix}-${randomChunk(4)}-${randomChunk(4)}`;
}

function defaultExpirationDate() {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  return date;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const { slug } = await params;
    const body = await request.json();
    const quantity = Math.max(1, Math.min(100, Number(body.quantity) || 1));
    const recipientName = String(body.recipientName || body.name || "").trim();
    const company = String(body.company || "").trim() || null;
    const batchName = String(body.batchName || "").trim() || company;

    if (!recipientName) {
      return Response.json({ error: "Recipient name is required." }, { status: 400 });
    }

    const expiresAt = body.expiresAt
      ? new Date(body.expiresAt)
      : defaultExpirationDate();

    if (expiresAt && Number.isNaN(expiresAt.getTime())) {
      return Response.json({ error: "Expiration date is invalid." }, { status: 400 });
    }

    const course = await prisma.masonCourse.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!course) {
      return Response.json({ error: "Course not found." }, { status: 404 });
    }

    const created: string[] = [];
    while (created.length < quantity) {
      const code = createCode(slug);
      try {
        await prisma.enrollmentCode.create({
          data: {
            code,
            courseId: course.id,
            batchName,
            recipientName,
            company,
            expiresAt,
          },
        });
        created.push(code);
      } catch {
        // A collision is extremely unlikely; generate another code.
      }
    }

    return Response.json({ codes: created }, { status: 201 });
  } catch (error) {
    console.error("Enrollment code generation failed:", error);
    return Response.json(
      { error: "Enrollment codes could not be generated." },
      { status: 500 },
    );
  }
}
