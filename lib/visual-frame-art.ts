type CanvasContext = CanvasRenderingContext2D;

function fillBackground(
  ctx: CanvasContext,
  width: number,
  height: number,
  top: string,
  bottom: string,
) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, top);
  gradient.addColorStop(1, bottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function drawPerson(
  ctx: CanvasContext,
  x: number,
  y: number,
  scale: number,
  shirt: string,
  pants: string,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = shirt;
  ctx.beginPath();
  ctx.arc(0, -42, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-18, -24, 36, 44);
  ctx.fillStyle = pants;
  ctx.fillRect(-14, 20, 12, 34);
  ctx.fillRect(2, 20, 12, 34);
  ctx.restore();
}

function drawTable(ctx: CanvasContext, x: number, y: number, width: number) {
  ctx.fillStyle = "#8aa3ad";
  ctx.fillRect(x, y, width, 10);
  ctx.fillRect(x + 12, y + 10, 10, 42);
  ctx.fillRect(x + width - 22, y + 10, 10, 42);
}

function drawHarassmentFrame(
  ctx: CanvasContext,
  width: number,
  height: number,
  frameIndex: number,
) {
  fillBackground(ctx, width, height, "#edf4f6", "#d7e4e8");

  if (frameIndex === 0) {
    drawTable(ctx, width * 0.28, height * 0.58, width * 0.44);
    drawPerson(ctx, width * 0.34, height * 0.56, 1.15, "#2f6f84", "#1f4d5d");
    drawPerson(ctx, width * 0.5, height * 0.56, 1.15, "#4f8ea3", "#2f6170");
    drawPerson(ctx, width * 0.66, height * 0.56, 1.15, "#7eb0bf", "#3f6f7d");
    ctx.fillStyle = "#f2c568";
    ctx.beginPath();
    ctx.arc(width * 0.5, height * 0.28, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(width * 0.5 - 18, height * 0.28);
    ctx.lineTo(width * 0.5 + 18, height * 0.28);
    ctx.stroke();
  } else if (frameIndex === 1) {
    drawPerson(ctx, width * 0.38, height * 0.62, 1.2, "#4f8ea3", "#2f6170");
    drawPerson(ctx, width * 0.62, height * 0.62, 1.2, "#b85c67", "#7a3d45");
    ctx.strokeStyle = "#f2c568";
    ctx.lineWidth = 6;
    ctx.setLineDash([10, 8]);
    ctx.strokeRect(width * 0.56, height * 0.34, width * 0.18, height * 0.16);
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(242, 197, 104, 0.25)";
    ctx.fillRect(width * 0.56, height * 0.34, width * 0.18, height * 0.16);
  } else if (frameIndex === 2) {
    drawPerson(ctx, width * 0.34, height * 0.62, 1.15, "#4f8ea3", "#2f6170");
    drawPerson(ctx, width * 0.66, height * 0.62, 1.15, "#2f6f84", "#1f4d5d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(width * 0.48, height * 0.28, width * 0.22, height * 0.14);
    ctx.strokeStyle = "#2f6f84";
    ctx.lineWidth = 4;
    ctx.strokeRect(width * 0.48, height * 0.28, width * 0.22, height * 0.14);
    ctx.fillStyle = "#2f6f84";
    ctx.beginPath();
    ctx.moveTo(width * 0.48, height * 0.36);
    ctx.lineTo(width * 0.42, height * 0.42);
    ctx.lineTo(width * 0.42, height * 0.32);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillStyle = "#2f6f84";
    ctx.beginPath();
    ctx.moveTo(width * 0.5, height * 0.22);
    ctx.lineTo(width * 0.68, height * 0.34);
    ctx.lineTo(width * 0.62, height * 0.58);
    ctx.lineTo(width * 0.38, height * 0.58);
    ctx.lineTo(width * 0.32, height * 0.34);
    ctx.closePath();
    ctx.fill();
    drawPerson(ctx, width * 0.5, height * 0.66, 1.1, "#7eb0bf", "#3f6f7d");
    ctx.strokeStyle = "#f2c568";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(width * 0.5, height * 0.4, 58, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  }
}

function drawLadderFrame(
  ctx: CanvasContext,
  width: number,
  height: number,
  frameIndex: number,
) {
  fillBackground(ctx, width, height, "#f4f1ea", "#e2ddd2");

  const ladderX = width * 0.46;
  const ladderTop = height * 0.18;
  const ladderBottom = height * 0.82;

  ctx.strokeStyle = "#d97706";
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(ladderX - 34, ladderBottom);
  ctx.lineTo(ladderX - 10, ladderTop);
  ctx.moveTo(ladderX + 34, ladderBottom);
  ctx.lineTo(ladderX + 10, ladderTop);
  ctx.stroke();

  for (let rung = 0; rung < 7; rung += 1) {
    const y = ladderBottom - rung * ((ladderBottom - ladderTop) / 6);
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(ladderX - 28 + rung * 2.5, y);
    ctx.lineTo(ladderX + 28 - rung * 2.5, y);
    ctx.stroke();
  }

  if (frameIndex === 0) {
    ctx.fillStyle = "#334155";
    ctx.fillRect(width * 0.18, height * 0.72, width * 0.18, height * 0.08);
    ctx.fillStyle = "#64748b";
    ctx.fillRect(width * 0.2, height * 0.66, width * 0.14, height * 0.06);
  } else if (frameIndex === 1) {
    ctx.strokeStyle = "#15803d";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(width * 0.2, height * 0.74);
    ctx.lineTo(width * 0.34, height * 0.58);
    ctx.lineTo(width * 0.48, height * 0.74);
    ctx.stroke();
    ctx.fillStyle = "#f2c568";
    ctx.beginPath();
    ctx.arc(width * 0.34, height * 0.56, 16, 0, Math.PI * 2);
    ctx.fill();
  } else if (frameIndex === 2) {
    drawPerson(ctx, width * 0.58, height * 0.7, 1, "#2563eb", "#1e3a8a");
    ctx.strokeStyle = "#f2c568";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(width * 0.58, height * 0.42);
    ctx.lineTo(width * 0.58, height * 0.56);
    ctx.moveTo(width * 0.5, height * 0.48);
    ctx.lineTo(width * 0.66, height * 0.48);
    ctx.stroke();
  } else {
    ctx.fillStyle = "#b91c1c";
    ctx.fillRect(width * 0.68, height * 0.24, width * 0.16, height * 0.1);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(width * 0.71, height * 0.28, width * 0.1, height * 0.03);
    ctx.fillRect(width * 0.71, height * 0.33, width * 0.1, height * 0.03);
  }
}

export function themeFromCourseSlug(slug?: string | null) {
  if (String(slug || "").includes("ladder")) return "ladder";
  return "harassment";
}

export function buildFramePicture(theme: string, frameIndex: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  const normalizedTheme = theme.toLowerCase();
  const isLadder =
    normalizedTheme.includes("ladder") || normalizedTheme.includes("osha");

  if (isLadder) {
    drawLadderFrame(ctx, 1280, 720, frameIndex % 4);
  } else {
    drawHarassmentFrame(ctx, 1280, 720, frameIndex % 4);
  }

  return canvas.toDataURL("image/jpeg", 0.85);
}

export function isEmbeddedPicture(source?: string | null) {
  return Boolean(source?.startsWith("data:image/"));
}
