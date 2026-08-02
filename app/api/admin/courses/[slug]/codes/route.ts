export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { randomInt } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-session";
import { parseExpirationDate } from "@/lib/enrollment-code";

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

function isUniqueViolation(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function databaseErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (
    message.includes("recipientName") ||
    message.includes("company") ||
    message.includes("column") ||
    message.includes("does not exist")
  ) {
    return "The database schema is out of date. Run npm run db:init on the server.";
  }
  return "Enrollment codes could not be generated.";
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
    const company = String(body.company || body.requestedBy || "").trim();
    const batchName = String(body.batchName || "").trim() || company;

    if (!company) {
      return Response.json(
        { error: "Enter the name or company requesting this course." },
        { status: 400 },
      );
    }

    let expiresAt: Date;
    try {
      expiresAt = parseExpirationDate(body.expiresAt);
    } catch {
      return Response.json({ error: "Expiration date is invalid." }, { status: 400 });
    }

    const course = await prisma.masonCourse.findUnique({
      where: { slug },
      select: { id: true, published: true, title: true },
    });
    if (!course) {
      return Response.json({ error: "Course not found." }, { status: 404 });
    }

    const created: string[] = [];
    let attempts = 0;
    const maxAttempts = Math.max(quantity * 10, 10);

    while (created.length < quantity && attempts < maxAttempts) {
      attempts += 1;
      const code = createCode(slug);

      try {
        await prisma.enrollmentCode.create({
          data: {
            code,
            courseId: course.id,
            batchName,
            company,
            expiresAt,
          },
        });
        created.push(code);
      } catch (error) {
        if (isUniqueViolation(error)) {
          continue;
        }

        console.error("Enrollment code generation failed:", error);
        return Response.json(
          { error: databaseErrorMessage(error) },
          { status: 500 },
        );
      }
    }

    if (created.length < quantity) {
      return Response.json(
        { error: "Enrollment codes could not be generated." },
        { status: 500 },
      );
    }

    return Response.json(
      {
        codes: created,
        warning: course.published
          ? null
          : "Codes were created, but this program is still a draft. Publish it under Program settings before learners can use these codes.",
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Enrollment code generation failed:", error);
    return Response.json(
      { error: databaseErrorMessage(error) },
      { status: 500 },
    );
  }
}
