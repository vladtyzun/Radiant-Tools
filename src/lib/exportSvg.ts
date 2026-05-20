import type { AlgorithmMode, EffectId, Params, ShapeId } from "./types";
import { TEXT_SHAPE_GLYPHS } from "./shapes";
import { sampleCell, shapeScaleFromMode, num } from "./effects/utils";

type SvgExportCtx = {
  effectId: EffectId;
  params: Params;
  algorithmMode: AlgorithmMode;
  shapeId: ShapeId;
  bgColor: string;
  w: number;
  h: number;
};

const SHAPE_TAG: Partial<Record<ShapeId, "circle" | "rect" | "polygon">> = {
  circle: "circle",
  square: "rect",
  triangle: "polygon",
  diamond: "polygon",
  hex: "polygon",
  star: "polygon",
};

export function buildSvg(
  data: Uint8ClampedArray,
  ctx: SvgExportCtx
): string | null {
  const { effectId, w, h, bgColor } = ctx;
  const parts: string[] = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`,
    `<rect width="100%" height="100%" fill="${escapeAttr(bgColor)}"/>`,
  ];

  if (effectId === "pattern") {
    parts.push(...patternShapes(data, ctx));
  } else if (effectId === "halftone") {
    parts.push(...halftoneCircles(data, ctx));
  } else if (effectId === "pixel") {
    parts.push(...pixelRects(data, ctx));
  } else if (effectId === "dotChar") {
    parts.push(...dotCharElements(data, ctx));
  } else {
    return null;
  }

  parts.push("</svg>");
  return parts.join("\n");
}

function patternShapes(data: Uint8ClampedArray, ctx: SvgExportCtx): string[] {
  const p = ctx.params;
  const cell = num(p, "cellSize", 16);
  const gap = num(p, "gap", 2);
  const step = cell + gap;
  const contrast = num(p, "contrast", 50);
  const threshold = num(p, "threshold", 0);
  const shapeScale = num(p, "shapeScale", 80);
  const invert = !!p.invert;
  const opacity = num(p, "opacity", 100) / 100;
  const els: string[] = [];

  for (let y = 0; y < ctx.h; y += step) {
    for (let x = 0; x < ctx.w; x += step) {
      const { r, g, b, l } = sampleCell(data, ctx.w, ctx.h, x, y, cell, contrast);
      if (l < threshold) continue;
      const scale = shapeScaleFromMode(l, ctx.algorithmMode, 100, shapeScale, invert);
      const size = cell * scale;
      if (size < 1) continue;
      const cx = x + cell / 2;
      const cy = y + cell / 2;
      const fill = inverseFill(ctx.algorithmMode, l, r, g, b, ctx.bgColor);
      els.push(shapeSvg(ctx.shapeId, cx, cy, size, fill, opacity));
    }
  }
  return els;
}

function halftoneCircles(data: Uint8ClampedArray, ctx: SvgExportCtx): string[] {
  const p = ctx.params;
  const cell = num(p, "cellSize", 12);
  const gap = num(p, "gap", 1);
  const step = cell + gap;
  const contrast = num(p, "contrast", 50);
  const minDot = num(p, "minDot", 5) / 100;
  const maxDot = num(p, "maxDot", 95) / 100;
  const threshold = num(p, "threshold", 0);
  const opacity = num(p, "opacity", 100) / 100;
  const mid = (minDot + maxDot) / 2;
  const els: string[] = [];

  for (let y = 0; y < ctx.h; y += step) {
    for (let x = 0; x < ctx.w; x += step) {
      const { r, g, b, l } = sampleCell(data, ctx.w, ctx.h, x, y, cell, contrast);
      if (l < threshold) continue;
      let t = 1 - l / 255;
      if (ctx.algorithmMode === "flat") t = mid;
      else if (ctx.algorithmMode === "inverse") t = l / 255;
      const radius = (cell / 2) * (minDot + t * (maxDot - minDot));
      const fill = inverseFill(ctx.algorithmMode, l, r, g, b, ctx.bgColor);
      const cx = x + cell / 2;
      const cy = y + cell / 2;
      els.push(
        `<circle cx="${cx}" cy="${cy}" r="${radius.toFixed(2)}" fill="${escapeAttr(fill)}" opacity="${opacity}"/>`
      );
    }
  }
  return els;
}

function pixelRects(data: Uint8ClampedArray, ctx: SvgExportCtx): string[] {
  const p = ctx.params;
  const cell = num(p, "cellSize", 8);
  const gap = num(p, "gap", 0);
  const step = cell + gap;
  const contrast = num(p, "contrast", 50);
  const opacity = num(p, "opacity", 100) / 100;
  const els: string[] = [];

  for (let y = 0; y < ctx.h; y += step) {
    for (let x = 0; x < ctx.w; x += step) {
      const { r, g, b, l } = sampleCell(data, ctx.w, ctx.h, x, y, cell, contrast);
      let alpha = opacity;
      if (ctx.algorithmMode === "halftone") alpha *= 1 - l / 255;
      else if (ctx.algorithmMode === "inverse") alpha *= l / 255;
      const fill = inverseFill(ctx.algorithmMode, l, r, g, b, ctx.bgColor);
      els.push(
        `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="${escapeAttr(fill)}" opacity="${alpha.toFixed(3)}"/>`
      );
    }
  }
  return els;
}

function dotCharElements(data: Uint8ClampedArray, ctx: SvgExportCtx): string[] {
  const p = ctx.params;
  const cell = num(p, "cellSize", 14);
  const gap = num(p, "gap", 2);
  const step = cell + gap;
  const contrast = num(p, "contrast", 47);
  const baseScale = num(p, "baseScale", 60) / 100;
  const effectPower = num(p, "effectPower", 100) / 100;
  const els: string[] = [];

  for (let y = 0; y < ctx.h; y += step) {
    for (let x = 0; x < ctx.w; x += step) {
      const { r, g, b, l } = sampleCell(data, ctx.w, ctx.h, x, y, cell, contrast);
      const cx = x + cell / 2;
      const cy = y + cell / 2;
      let t = 1 - l / 255;
      if (ctx.algorithmMode === "flat") t = 0.5;
      else if (ctx.algorithmMode === "inverse") t = l / 255;
      const dotR = (cell / 2) * (baseScale * 0.3 + t * effectPower * 0.7);
      const fill = inverseFill(ctx.algorithmMode, l, r, g, b, ctx.bgColor);
      els.push(
        `<circle cx="${cx}" cy="${cy}" r="${dotR.toFixed(2)}" fill="${escapeAttr(fill)}"/>`
      );
    }
  }
  return els;
}

function inverseFill(
  mode: AlgorithmMode,
  l: number,
  r: number,
  g: number,
  b: number,
  bg: string
): string {
  if (mode !== "inverse") return rgb(r, g, b);
  return l > 128 ? bg : rgb(r, g, b);
}

function shapeSvg(
  shapeId: ShapeId,
  cx: number,
  cy: number,
  size: number,
  fill: string,
  opacity: number
): string {
  const glyph = TEXT_SHAPE_GLYPHS[shapeId];
  if (glyph) {
    const fs = (size * 0.88).toFixed(2);
    return `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" font-size="${fs}" font-family="system-ui, sans-serif" fill="${escapeAttr(fill)}" opacity="${opacity}">${escapeText(glyph)}</text>`;
  }
  const s = size / 2;
  const tag = SHAPE_TAG[shapeId];
  if (tag === "circle" || shapeId === "circle" || shapeId === "ring") {
    const inner = shapeId === "ring" ? s * 0.55 : 0;
    if (shapeId === "ring") {
      return `<circle cx="${cx}" cy="${cy}" r="${s}" fill="${escapeAttr(fill)}" opacity="${opacity}"/><circle cx="${cx}" cy="${cy}" r="${inner}" fill="${escapeAttr(fill)}" opacity="0"/>`;
    }
    return `<circle cx="${cx}" cy="${cy}" r="${s}" fill="${escapeAttr(fill)}" opacity="${opacity}"/>`;
  }
  if (tag === "rect" || shapeId === "square" || shapeId === "cross") {
    return `<rect x="${cx - s}" y="${cy - s}" width="${size}" height="${size}" fill="${escapeAttr(fill)}" opacity="${opacity}"/>`;
  }
  if (shapeId === "triangle") {
    const pts = `${cx},${cy - s} ${cx + s},${cy + s * 0.85} ${cx - s},${cy + s * 0.85}`;
    return `<polygon points="${pts}" fill="${escapeAttr(fill)}" opacity="${opacity}"/>`;
  }
  if (shapeId === "diamond") {
    const pts = `${cx},${cy - s} ${cx + s},${cy} ${cx},${cy + s} ${cx - s},${cy}`;
    return `<polygon points="${pts}" fill="${escapeAttr(fill)}" opacity="${opacity}"/>`;
  }
  return `<circle cx="${cx}" cy="${cy}" r="${s}" fill="${escapeAttr(fill)}" opacity="${opacity}"/>`;
}

function rgb(r: number, g: number, b: number) {
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

function escapeAttr(s: string) {
  return s.replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function escapeText(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function downloadSvg(svg: string, filename = "pattern-export.svg") {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function rasterFallbackSvg(canvas: HTMLCanvasElement): string {
  const w = canvas.width;
  const h = canvas.height;
  const url = canvas.toDataURL("image/png");
  return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><image width="${w}" height="${h}" xlink:href="${url}"/></svg>`;
}
