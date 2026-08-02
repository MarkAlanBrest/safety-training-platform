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
    throw new Error("The server returned an invalid response.");
  }
}
