export const runtime = "nodejs";

import { extractResponseOutputText } from "@/lib/parse-response";
import { classroomInstructorPrompt, defaultClassroomBuilderConfig } from "@/lib/classroom-builder";
import { isClassroomPlan } from "@/lib/classroom";
import { normalizeEnrollmentCode } from "@/lib/enrollment-code";
import { prisma } from "@/lib/prisma";
import { scormInstructorConfigFromLessonPlan } from "@/lib/scorm-instructor";

type ChatMessage = { role: "user" | "assistant"; content: string };

type ChatBody = {
  code?: string;
  preview?: boolean;
  messages?: ChatMessage[];
  scormLocation?: string;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const body = (await request.json()) as ChatBody;
    const preview = body.preview === true;
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const lastUser = [...messages].reverse().find((message) => message.role === "user");

    const course = await prisma.masonCourse.findUnique({
      where: { slug },
      include: {
        sections: {
          orderBy: { position: "asc" },
          take: 1,
          select: { lessonPlan: true },
        },
      },
    });

    if (!course || course.courseType !== "scorm") {
      return Response.json({ error: "Course not found." }, { status: 404 });
    }

    if (!preview) {
      const code = normalizeEnrollmentCode(String(body.code || ""));
      const access = await prisma.enrollmentCode.findUnique({
        where: { code },
        include: { course: true, enrollment: true },
      });
      if (
        !access ||
        access.course.slug !== slug ||
        access.course.courseType !== "scorm" ||
        !access.enrollment
      ) {
        return Response.json({ error: "A valid enrollment code is required." }, { status: 403 });
      }
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "OPENAI_API_KEY is not configured." }, { status: 500 });
    }

    const lessonPlan = course.sections[0]?.lessonPlan;
    const instructor = scormInstructorConfigFromLessonPlan(lessonPlan);
    const builderConfig = isClassroomPlan(lessonPlan)
      ? lessonPlan.config || defaultClassroomBuilderConfig()
      : defaultClassroomBuilderConfig();

    const scormLocation = String(body.scormLocation || "").trim();
    const context = [
      `Course: ${course.title}`,
      course.description ? `Description: ${course.description}` : "",
      scormLocation ? `SCORM location: ${scormLocation}` : "SCORM location: unknown",
      `Instructor preferences:\n${classroomInstructorPrompt(builderConfig)}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        instructions: [
          "You are a warm, concise AI instructor supporting a SCORM safety-training course.",
          "The learner is working through packaged lesson content in an iframe. You cannot see the screen.",
          "Answer questions clearly in 2-4 sentences unless they ask for more detail.",
          "When helpful, connect your answer to workplace safety best practices.",
          "Return JSON only.",
        ].join(" "),
        text: {
          format: {
            type: "json_schema",
            name: "scorm_instructor_reply",
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["reply", "expectsResponse"],
              properties: {
                reply: { type: "string" },
                expectsResponse: { type: "boolean" },
              },
            },
          },
        },
        input: [
          {
            role: "user",
            content: [
              context,
              "Conversation so far:",
              messages.map((message) => `${message.role}: ${message.content}`).join("\n") ||
                "(no prior messages)",
              lastUser
                ? `Respond to the learner's latest message: ${lastUser.content}`
                : "Give a brief welcome and explain they can ask questions while working through the lesson.",
            ].join("\n\n"),
          },
        ],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return Response.json({ error: "The instructor could not respond." }, { status: 500 });
    }

    const parsed = JSON.parse(extractResponseOutputText(data) || "{}") as {
      reply?: string;
      expectsResponse?: boolean;
    };

    return Response.json({
      reply: parsed.reply || instructor.opening || "I'm here if you have questions.",
      expectsResponse: Boolean(parsed.expectsResponse),
    });
  } catch (error) {
    console.error("SCORM chat failed:", error);
    return Response.json({ error: "The instructor could not respond." }, { status: 500 });
  }
}
