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
        : `Request failed (${response.status}). The database may need to be updated — run npm run db:init.`,
    );
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    const preview = text.replace(/\s+/g, " ").slice(0, 180);
    throw new Error(
      response.ok
        ? "The server returned an invalid response."
        : `Upload failed (${response.status}): ${preview || "No details returned."}`,
    );
  }
}
