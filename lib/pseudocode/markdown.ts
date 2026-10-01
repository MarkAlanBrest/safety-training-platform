// Small, safe Markdown renderer for coach replies: fenced code, lists, headings, **bold**, `code`.
const ENTITIES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escapeHtml = (text: string) => String(text).replace(/[&<>"']/g, (c) => ENTITIES[c]);

function inline(text: string) {
  return text
    .split(/(`[^`\n]+`)/g)
    .map((part, i) =>
      i % 2
        ? `<code>${escapeHtml(part.slice(1, -1))}</code>`
        : escapeHtml(part).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>"),
    )
    .join("");
}

const FENCE = /^\s*```/;
const BULLET = /^\s*[-*]\s+/;
const NUMBERED = /^\s*\d+[.)]\s+/;
const HEADING = /^\s*#{1,4}\s+/;
const BLOCK_START = /^\s*(```|[-*]\s+|\d+[.)]\s+|#{1,4}\s)/;

export function renderMarkdown(source: string) {
  const lines = String(source).replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;

  const collect = (pattern: RegExp) => {
    const items: string[] = [];
    while (i < lines.length && pattern.test(lines[i])) items.push(lines[i++].replace(pattern, ""));
    return items.map((item) => `<li>${inline(item)}</li>`).join("");
  };

  while (i < lines.length) {
    const line = lines[i];
    if (FENCE.test(line)) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !FENCE.test(lines[i])) code.push(lines[i++]);
      i++;
      out.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
    } else if (BULLET.test(line)) {
      out.push(`<ul>${collect(BULLET)}</ul>`);
    } else if (NUMBERED.test(line)) {
      out.push(`<ol>${collect(NUMBERED)}</ol>`);
    } else if (HEADING.test(line)) {
      out.push(`<p class="heading">${inline(line.replace(HEADING, ""))}</p>`);
      i++;
    } else if (!line.trim()) {
      i++;
    } else {
      const paragraph: string[] = [];
      while (i < lines.length && lines[i].trim() && !BLOCK_START.test(lines[i])) paragraph.push(lines[i++]);
      out.push(`<p>${paragraph.map(inline).join("<br>")}</p>`);
    }
  }

  return out.join("");
}
