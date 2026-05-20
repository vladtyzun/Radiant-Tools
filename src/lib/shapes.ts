import type { ShapeId } from "./types";

/** Unicode dingbats rendered via canvas/SVG text (text presentation where noted). */
export const TEXT_SHAPE_GLYPHS: Partial<Record<ShapeId, string>> = {
  pinwheel: "\u2722",
  sparkle: "\u2726",
  asterisk: "\u2733\uFE0E",
  multiply: "\u2715",
  diamondCross: "\u2756",
  bullseye: "\u29BF",
};

const TEXT_SHAPE_FONT =
  'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export function drawShape(
  ctx: CanvasRenderingContext2D,
  shapeId: ShapeId,
  cx: number,
  cy: number,
  size: number,
  customPath?: Path2D | null
) {
  const glyph = TEXT_SHAPE_GLYPHS[shapeId];
  if (glyph) {
    drawTextGlyph(ctx, glyph, cx, cy, size);
    return;
  }
  const s = size / 2;
  ctx.beginPath();
  if (shapeId === "custom" && customPath) {
    ctx.save();
    ctx.translate(cx - s, cy - s);
    ctx.scale(size, size);
    ctx.fill(customPath);
    ctx.restore();
    return;
  }
  switch (shapeId) {
    case "circle":
      ctx.arc(cx, cy, s, 0, Math.PI * 2);
      break;
    case "square":
      ctx.rect(cx - s, cy - s, size, size);
      break;
    case "cross": {
      const t = s * 0.35;
      ctx.rect(cx - s, cy - t, size, t * 2);
      ctx.rect(cx - t, cy - s, t * 2, size);
      break;
    }
    case "ring":
      ctx.arc(cx, cy, s, 0, Math.PI * 2);
      ctx.arc(cx, cy, s * 0.55, 0, Math.PI * 2, true);
      break;
    case "triangle":
      ctx.moveTo(cx, cy - s);
      ctx.lineTo(cx + s, cy + s * 0.85);
      ctx.lineTo(cx - s, cy + s * 0.85);
      ctx.closePath();
      break;
    case "star":
      starPath(ctx, cx, cy, s, s * 0.45, 5);
      break;
    case "diamond":
      ctx.moveTo(cx, cy - s);
      ctx.lineTo(cx + s, cy);
      ctx.lineTo(cx, cy + s);
      ctx.lineTo(cx - s, cy);
      ctx.closePath();
      break;
    case "hex":
      polygon(ctx, cx, cy, s, 6);
      break;
    default:
      ctx.arc(cx, cy, s, 0, Math.PI * 2);
  }
  if (shapeId === "ring") ctx.fill("evenodd");
  else ctx.fill();
}

function drawTextGlyph(
  ctx: CanvasRenderingContext2D,
  glyph: string,
  cx: number,
  cy: number,
  size: number
) {
  const fontSize = size * 0.88;
  ctx.save();
  ctx.font = `${fontSize}px ${TEXT_SHAPE_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(glyph, cx, cy);
  ctx.restore();
}

function starPath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  points: number
) {
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI / points) * i - Math.PI / 2;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function polygon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  sides: number
) {
  for (let i = 0; i < sides; i++) {
    const a = ((Math.PI * 2) / sides) * i - Math.PI / 2;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

export function parseSvgToPath(svgText: string): Path2D | null {
  try {
    const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
    const svg = doc.querySelector("svg");
    if (!svg) return null;
    const viewBox = svg.getAttribute("viewBox")?.split(/\s+/).map(Number) || [0, 0, 100, 100];
    const w = viewBox[2] || 100;
    const h = viewBox[3] || 100;
    const pathEl = svg.querySelector("path");
    if (pathEl?.getAttribute("d")) {
      const p = new Path2D(pathEl.getAttribute("d")!);
      const m = document.createElement("canvas").getContext("2d");
      if (!m) return p;
      const temp = new Path2D();
      m.save();
      m.scale(1 / w, 1 / h);
      return p;
    }
    const circle = svg.querySelector("circle");
    if (circle) {
      const cx = Number(circle.getAttribute("cx") || 50) / w;
      const cy = Number(circle.getAttribute("cy") || 50) / h;
      const r = Number(circle.getAttribute("r") || 40) / Math.max(w, h);
      const p = new Path2D();
      p.arc(cx, cy, r, 0, Math.PI * 2);
      return p;
    }
    const rect = svg.querySelector("rect");
    if (rect) {
      const x = Number(rect.getAttribute("x") || 0) / w;
      const y = Number(rect.getAttribute("y") || 0) / h;
      const rw = Number(rect.getAttribute("width") || w) / w;
      const rh = Number(rect.getAttribute("height") || h) / h;
      const p = new Path2D();
      p.rect(x, y, rw, rh);
      return p;
    }
  } catch {
    return null;
  }
  return null;
}

export const SHAPE_OPTIONS: { id: ShapeId; label: string }[] = [
  { id: "circle", label: "○" },
  { id: "square", label: "□" },
  { id: "cross", label: "+" },
  { id: "ring", label: "◎" },
  { id: "triangle", label: "△" },
  { id: "star", label: "★" },
  { id: "diamond", label: "◇" },
  { id: "hex", label: "⬡" },
  { id: "pinwheel", label: "\u2722" },
  { id: "sparkle", label: "\u2726" },
  { id: "asterisk", label: "\u2733\uFE0E" },
  { id: "multiply", label: "\u2715" },
  { id: "diamondCross", label: "\u2756" },
  { id: "bullseye", label: "\u29BF" },
];
