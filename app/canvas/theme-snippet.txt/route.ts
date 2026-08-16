import { readFile } from "node:fs/promises";
import path from "node:path";

export async function GET() {
  const origin = (process.env.NEXT_PUBLIC_APP_ORIGIN || "https://safety-training-platform-eight.vercel.app").replace(
    /\/+$/,
    "",
  );
  const filePath = path.join(process.cwd(), "public", "canvas-banner.js");
  const script = await readFile(filePath, "utf8");
  const snippet =
    "<!-- One-time setup: Canvas Admin → Themes → Edit → Global/Login → JavaScript -->\n" +
    "<!-- Bold popup on course home. Does not change your home page content. -->\n" +
    `<script src="${origin}/canvas-banner.js"></script>\n\n` +
    "<!-- Or paste the full script inline if external scripts are blocked -->\n" +
    "<script>\n" +
    script +
    "\n</script>";

  return new Response(snippet, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
