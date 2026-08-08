export function extractResponseOutputText(data: {
  output_text?: string;
  output?: Array<{ content?: Array<{ text?: string }> }>;
}) {
  return (
    data.output_text ||
    data.output
      ?.flatMap((item) => item.content || [])
      .map((item) => item.text)
      .filter(Boolean)
      .join("") ||
    ""
  );
}

export async function parseJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();

  if (!text) {
    throw new Error(
      response.ok
        ? "The server returned an empty response."
        : `Request failed (${response.status}). The server returned no details — try a smaller video file or try again in a moment.`,
    );
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    const normalized = text.replace(/\s+/g, " ").trim();
    const lower = normalized.toLowerCase();
    if (lower.includes("request entity too large")) {
      throw new Error(
        "Upload is too large for the server. SCORM ZIP files must be 4 MB or smaller.",
      );
    }
    const preview = normalized.slice(0, 180);
    throw new Error(
      response.ok
        ? "The server returned an invalid response."
        : `Request failed (${response.status}): ${preview || "No details returned."}`,
    );
  }
}
