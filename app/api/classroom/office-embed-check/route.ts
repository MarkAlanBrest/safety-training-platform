export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OFFICE_EMBED_ORIGIN = "https://view.officeapps.live.com";

function isAllowedDeckPath(pathname: string) {
  return /\/api\/classroom\/[^/]+(?:\/chapters\/\d+)?\/(?:deck|presentation\.pptx|embed\/deck)$/.test(
    pathname,
  );
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const deckPath = requestUrl.searchParams.get("deckPath");
  if (!deckPath || !deckPath.startsWith("/") || !isAllowedDeckPath(deckPath)) {
    return Response.json({ ok: false, reason: "invalid_deck_path" }, { status: 400 });
  }

  const absoluteDeck = new URL(deckPath, requestUrl.origin).href;
  const viewer = new URL(`${OFFICE_EMBED_ORIGIN}/op/embed.aspx`);
  viewer.searchParams.set("src", absoluteDeck);
  viewer.searchParams.set("wdSlideIndex", "1");

  try {
    const response = await fetch(viewer.href, { cache: "no-store" });
    if (!response.ok) {
      return Response.json({ ok: false, reason: "office_unreachable" });
    }

    const html = await response.text();
    const match = html.match(/_failureRedirectUrl\s*=\s*'([^']*)'/);
    const ok = !match?.[1];
    return Response.json({
      ok,
      reason: ok ? null : "office_file_not_found",
    });
  } catch {
    return Response.json({ ok: false, reason: "office_check_failed" });
  }
}
