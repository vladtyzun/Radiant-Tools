import type { AlgorithmMode, EffectId, FocalPoint, Params, ShapeId } from "../types";
import { drawShape } from "../shapes";
import {
  applyContrast,
  charFromLuma,
  fillForAlgorithm,
  num,
  sampleCell,
  shapeScaleFromMode,
  str,
} from "./utils";
import { computeMotionRegions, renderTrackBase, readTrackParams } from "./track";
import { drawMotionRegions } from "../tracking/draw";

export type RenderContext = {
  effectId: EffectId;
  params: Params;
  algorithmMode: AlgorithmMode;
  shapeId: ShapeId;
  customPath: Path2D | null;
  bgColor: string;
  prevFrame: Uint8ClampedArray | null;
  focalPoint: FocalPoint;
  useFocalPoint: boolean;
};

const FOCAL_MIN_WEIGHT = 0.25;

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Normalized coords 0–1; 1 at focal, ~0.25 at farthest canvas edge from focal. */
export function getFocalWeight(
  nx: number,
  ny: number,
  focal: FocalPoint,
  enabled: boolean
): number {
  if (!enabled) return 1;
  const dx = nx - focal.x;
  const dy = ny - focal.y;
  const dist = Math.hypot(dx, dy);
  const maxDist = Math.max(
    Math.hypot(focal.x, focal.y),
    Math.hypot(1 - focal.x, focal.y),
    Math.hypot(focal.x, 1 - focal.y),
    Math.hypot(1 - focal.x, 1 - focal.y)
  );
  const t = smoothstep(0, maxDist, dist);
  return 1 - (1 - FOCAL_MIN_WEIGHT) * t;
}

let bayer4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

export function renderEffect(
  out: CanvasRenderingContext2D,
  src: CanvasRenderingContext2D,
  w: number,
  h: number,
  ctx: RenderContext
) {
  // Glass/fractalGlass/blur/motionBlur read src canvas; skip bg fill so in-place src stays intact.
  if (ctx.effectId === "glass") {
    renderGlass(out, src.canvas, w, h, ctx.params, ctx.focalPoint, ctx.useFocalPoint);
    return;
  }
  if (ctx.effectId === "fractalGlass") {
    renderFractalGlass(out, src, w, h, ctx.params);
    return;
  }
  if (ctx.effectId === "blur") {
    renderBlur(out, src, w, h, ctx.params);
    return;
  }
  if (ctx.effectId === "motionBlur") {
    renderMotionBlur(out, src, w, h, ctx);
    return;
  }

  const img = src.getImageData(0, 0, w, h);
  const data = img.data;
  out.fillStyle = ctx.bgColor;
  out.fillRect(0, 0, w, h);

  switch (ctx.effectId) {
    case "pattern":
      renderPattern(out, data, w, h, ctx);
      break;
    case "halftone":
      renderHalftone(out, data, w, h, ctx);
      break;
    case "track":
      renderTrack(out, data, w, h, ctx);
      break;
    case "dotChar":
      renderDotChar(out, data, w, h, ctx);
      break;
    case "pixel":
      renderPixel(out, data, w, h, ctx);
      break;
    case "ascii":
      renderAscii(out, data, w, h, ctx);
      break;
    case "dither":
      renderDither(out, data, w, h, ctx.params);
      break;
    case "glitch":
      renderGlitch(out, data, w, h, ctx);
      break;
    case "vintage":
      renderVintage(out, data, w, h, ctx);
      break;
    case "cHtone":
      renderCHtone(out, data, w, h, ctx.params, ctx.bgColor);
      break;
    case "imgTrack":
      renderImgTrack(out, data, w, h, ctx.params);
      break;
    case "stage":
      renderStage(out, data, w, h, ctx);
      break;
  }
}

function renderPattern(
  out: CanvasRenderingContext2D,
  data: Uint8ClampedArray,
  w: number,
  h: number,
  ctx: RenderContext
) {
  const p = ctx.params;
  const cell = num(p, "cellSize", 16);
  const gap = num(p, "gap", 2);
  const step = cell + gap;
  const contrast = num(p, "contrast", 50);
  const opacity = num(p, "opacity", 100) / 100;
  const threshold = num(p, "threshold", 0);
  const shapeScale = num(p, "shapeScale", 80);
  const invert = !!p.invert;
  const effectPower = 100;

  out.globalAlpha = opacity;
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const fw = getFocalWeight((x + cell / 2) / w, (y + cell / 2) / h, ctx.focalPoint, ctx.useFocalPoint);
      const { r, g, b, l } = sampleCell(data, w, h, x, y, cell, contrast);
      if (l < threshold) continue;
      const scale = shapeScaleFromMode(l, ctx.algorithmMode, effectPower, shapeScale, invert) * fw;
      const size = cell * scale;
      if (size < 1) continue;
      out.globalAlpha = opacity * fw;
      out.fillStyle = fillForAlgorithm(ctx.algorithmMode, l, r, g, b, ctx.bgColor);
      drawShape(out, ctx.shapeId, x + cell / 2, y + cell / 2, size, ctx.customPath);
    }
  }
  out.globalAlpha = 1;
}

function renderHalftone(
  out: CanvasRenderingContext2D,
  data: Uint8ClampedArray,
  w: number,
  h: number,
  ctx: RenderContext
) {
  const p = ctx.params;
  const cell = num(p, "cellSize", 12);
  const gap = num(p, "gap", 1);
  const step = cell + gap;
  const contrast = num(p, "contrast", 50);
  const opacity = num(p, "opacity", 100) / 100;
  const minDot = num(p, "minDot", 5) / 100;
  const maxDot = num(p, "maxDot", 95) / 100;
  const threshold = num(p, "threshold", 0);
  const mid = (minDot + maxDot) / 2;

  out.globalAlpha = opacity;
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const fw = getFocalWeight((x + cell / 2) / w, (y + cell / 2) / h, ctx.focalPoint, ctx.useFocalPoint);
      const { r, g, b, l } = sampleCell(data, w, h, x, y, cell, contrast);
      if (l < threshold) continue;
      let t = 1 - l / 255;
      if (ctx.algorithmMode === "flat") t = mid;
      else if (ctx.algorithmMode === "inverse") t = l / 255;
      const radius = (cell / 2) * (minDot + t * (maxDot - minDot)) * fw;
      out.fillStyle = fillForAlgorithm(ctx.algorithmMode, l, r, g, b, ctx.bgColor);
      out.beginPath();
      out.arc(x + cell / 2, y + cell / 2, radius, 0, Math.PI * 2);
      out.fill();
    }
  }
  out.globalAlpha = 1;
}

function renderTrack(
  out: CanvasRenderingContext2D,
  data: Uint8ClampedArray,
  w: number,
  h: number,
  ctx: RenderContext
) {
  const tp = readTrackParams(ctx.params);
  if (!ctx.prevFrame || ctx.prevFrame.length !== data.length) {
    renderTrackBase(out, data, w, h, tp.invert);
    return;
  }
  renderTrackBase(out, data, w, h, tp.invert);
  if (tp.trackMotion) {
    const regions = computeMotionRegions(
      data,
      ctx.prevFrame,
      w,
      h,
      tp.block,
      tp.sens,
      tp.maxR
    );
    drawMotionRegions(out, regions, tp.block, tp.color, tp.style, w, h, {
      x: 0,
      y: 0,
      w,
      h,
    });
  }
}

function renderDotChar(
  out: CanvasRenderingContext2D,
  data: Uint8ClampedArray,
  w: number,
  h: number,
  ctx: RenderContext
) {
  const p = ctx.params;
  const cell = num(p, "cellSize", 14);
  const gap = num(p, "gap", 2);
  const step = cell + gap;
  const contrast = num(p, "contrast", 47);
  const baseScale = num(p, "baseScale", 60) / 100;
  const effectPower = num(p, "effectPower", 100) / 100;

  out.textAlign = "center";
  out.textBaseline = "middle";
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const { r, g, b, l } = sampleCell(data, w, h, x, y, cell, contrast);
      const cx = x + cell / 2;
      const cy = y + cell / 2;
      let t = 1 - l / 255;
      if (ctx.algorithmMode === "flat") t = 0.5;
      else if (ctx.algorithmMode === "inverse") t = l / 255;
      const dotR = (cell / 2) * (baseScale * 0.3 + t * effectPower * 0.7);
      out.fillStyle = fillForAlgorithm(ctx.algorithmMode, l, r, g, b, ctx.bgColor);
      out.beginPath();
      out.arc(cx, cy, dotR, 0, Math.PI * 2);
      out.fill();
      out.fillStyle = l > 128 ? "#111" : "#eee";
      out.font = `${Math.max(8, cell * 0.7)}px monospace`;
      out.fillText(charFromLuma(l), cx, cy);
    }
  }
}

function renderPixel(
  out: CanvasRenderingContext2D,
  data: Uint8ClampedArray,
  w: number,
  h: number,
  ctx: RenderContext
) {
  const p = ctx.params;
  const cell = num(p, "cellSize", 8);
  const gap = num(p, "gap", 0);
  const step = cell + gap;
  const contrast = num(p, "contrast", 50);
  const opacity = num(p, "opacity", 100) / 100;
  const showGrid = !!p.showGrid;

  out.globalAlpha = opacity;
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const fw = getFocalWeight((x + cell / 2) / w, (y + cell / 2) / h, ctx.focalPoint, ctx.useFocalPoint);
      const { r, g, b, l } = sampleCell(data, w, h, x, y, cell, contrast);
      let alpha = opacity * fw;
      if (ctx.algorithmMode === "halftone") alpha *= 1 - l / 255;
      else if (ctx.algorithmMode === "inverse") alpha *= l / 255;
      out.globalAlpha = alpha;
      out.fillStyle = fillForAlgorithm(ctx.algorithmMode, l, r, g, b, ctx.bgColor);
      out.fillRect(x, y, cell, cell);
      out.globalAlpha = opacity;
    }
  }
  out.globalAlpha = opacity;
  if (showGrid) {
    out.strokeStyle = "#000";
    out.lineWidth = 1;
    out.globalAlpha = 1;
    for (let x = 0; x <= w; x += step) {
      out.beginPath();
      out.moveTo(x, 0);
      out.lineTo(x, h);
      out.stroke();
    }
    for (let y = 0; y <= h; y += step) {
      out.beginPath();
      out.moveTo(0, y);
      out.lineTo(w, y);
      out.stroke();
    }
  }
  out.globalAlpha = 1;
}

let glassSrcBuf: HTMLCanvasElement | null = null;

function glassSourceCanvas(src: HTMLCanvasElement, w: number, h: number): HTMLCanvasElement {
  if (!glassSrcBuf) glassSrcBuf = document.createElement("canvas");
  if (glassSrcBuf.width !== w || glassSrcBuf.height !== h) {
    glassSrcBuf.width = w;
    glassSrcBuf.height = h;
  }
  glassSrcBuf.getContext("2d")!.drawImage(src, 0, 0, w, h);
  return glassSrcBuf;
}

function glassRingCount(p: Params): number {
  const legacy = p.tileSize != null ? num(p, "tileSize", 20) : undefined;
  const raw = num(p, "rings", legacy ?? 20);
  return Math.min(40, Math.max(3, Math.round(raw)));
}

/** Degrees 0–180; legacy stored values ≤20 are treated as old 0–20 scale. */
function glassTurnDegrees(p: Params): number {
  const raw = num(p, "spiralTurns", 90);
  if (raw > 0 && raw <= 20) return (raw / 20) * 180;
  return Math.min(180, Math.max(0, raw));
}

/** Radial annulus slices rotated per ring — static base, swirl disk only inside maxR. */
function renderGlass(
  out: CanvasRenderingContext2D,
  srcCanvas: HTMLCanvasElement,
  w: number,
  h: number,
  p: Params,
  focal: FocalPoint,
  useFocal: boolean
) {
  const turnDeg = glassTurnDegrees(p);
  const src =
    out.canvas === srcCanvas ? glassSourceCanvas(srcCanvas, w, h) : srcCanvas;
  if (turnDeg <= 0) {
    out.drawImage(src, 0, 0, w, h);
    return;
  }

  const rings = glassRingCount(p);
  const stagger = num(p, "stagger", 50) / 100;
  const distort = num(p, "distortion", 55) / 100;
  const opacity = num(p, "opacity", 100) / 100;

  const cx = useFocal ? focal.x * w : w * 0.5;
  const cy = useFocal ? focal.y * h : h * 0.5;
  const maxR = Math.min(
    Math.hypot(cx, cy),
    Math.hypot(w - cx, cy),
    Math.hypot(cx, h - cy),
    Math.hypot(w - cx, h - cy)
  );

  const twistScale = 0.25 + distort * 0.75;
  const turnsScale = (turnDeg / 180) * Math.PI * 2 * twistScale;
  const staggerRad = stagger * turnsScale;

  out.imageSmoothingEnabled = true;
  out.setTransform(1, 0, 0, 1, 0, 0);
  out.globalAlpha = 1;
  out.drawImage(src, 0, 0, w, h);

  out.save();
  out.globalAlpha = opacity;
  out.globalCompositeOperation = "source-over";

  for (let i = 0; i < rings; i++) {
    const r0 = (i / rings) * maxR;
    const r1 = ((i + 1) / rings) * maxR;
    const ringT = i / rings;
    const angle_i = ringT * staggerRad + ringT * stagger * Math.PI * 2;

    out.save();
    out.beginPath();
    out.arc(cx, cy, r1, 0, Math.PI * 2);
    if (r0 > 0.5) out.arc(cx, cy, r0, 0, Math.PI * 2, true);
    out.clip("evenodd");

    out.translate(cx, cy);
    out.rotate(angle_i);
    out.translate(-cx, -cy);
    out.drawImage(src, 0, 0, w, h);
    out.restore();
  }

  out.restore();
  out.globalAlpha = 1;
  out.globalCompositeOperation = "source-over";
}

let fractalBlurBuf: HTMLCanvasElement | null = null;

function fractalHash(i: number, seed: number) {
  return (((i * 374761393 + seed * 668265263) >>> 0) % 10000) / 10000;
}

/** Uneven pane boundaries for fractal column/row widths (variation 0 = equal). */
function fractalPaneEdges(size: number, count: number, variation: number, seed: number): number[] {
  const n = Math.min(40, Math.max(1, Math.round(count)));
  if (n <= 1) return [0, size];
  const v = Math.min(1, Math.max(0, variation / 100));
  const weights: number[] = [];
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const w = 1 + (fractalHash(i, seed) - 0.5) * 2 * v * 0.85;
    weights.push(Math.max(0.15, w));
    sum += weights[weights.length - 1];
  }
  const edges = [0];
  let pos = 0;
  for (let i = 0; i < n; i++) {
    pos += (weights[i] / sum) * size;
    edges.push(i === n - 1 ? size : Math.round(pos));
  }
  edges[edges.length - 1] = size;
  return edges;
}

type FractalPane = { x: number; y: number; w: number; h: number };

function fractalPanes(
  w: number,
  h: number,
  layout: string,
  count: number,
  variation: number,
  seed: number
): FractalPane[] {
  const panes: FractalPane[] = [];
  if (layout === "rows") {
    const edges = fractalPaneEdges(h, count, variation, seed + 1);
    for (let i = 0; i < edges.length - 1; i++) {
      const y0 = edges[i];
      const y1 = edges[i + 1];
      if (y1 > y0) panes.push({ x: 0, y: y0, w, h: y1 - y0 });
    }
    return panes;
  }
  if (layout === "grid") {
    const n = Math.min(20, Math.max(2, Math.round(count)));
    const xEdges = fractalPaneEdges(w, n, variation, seed);
    const yEdges = fractalPaneEdges(h, n, variation, seed + 97);
    for (let row = 0; row < yEdges.length - 1; row++) {
      for (let col = 0; col < xEdges.length - 1; col++) {
        const x0 = xEdges[col];
        const x1 = xEdges[col + 1];
        const y0 = yEdges[row];
        const y1 = yEdges[row + 1];
        if (x1 > x0 && y1 > y0) panes.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
      }
    }
    return panes;
  }
  const edges = fractalPaneEdges(w, count, variation, seed);
  for (let i = 0; i < edges.length - 1; i++) {
    const x0 = edges[i];
    const x1 = edges[i + 1];
    if (x1 > x0) panes.push({ x: x0, y: 0, w: x1 - x0, h });
  }
  return panes;
}

function paneGradientRgb(
  base: { r: number; g: number; b: number },
  strength: number
): { dark: string; mid: string } {
  const s = Math.min(1, Math.max(0, strength));
  const dr = (base.r * 0.5) | 0;
  const dg = (base.g * 0.5) | 0;
  const db = (base.b * 0.5) | 0;
  const lr = Math.min(255, (base.r * (1 + 0.45 * s)) | 0);
  const lg = Math.min(255, (base.g * (1 + 0.45 * s)) | 0);
  const lb = Math.min(255, (base.b * (1 + 0.45 * s)) | 0);
  return { dark: `${dr},${dg},${db}`, mid: `${lr},${lg},${lb}` };
}

function samplePaneColor(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  pane: FractalPane,
  layout: string
): { r: number; g: number; b: number } {
  const band = Math.max(2, Math.floor((layout === "rows" ? pane.w : pane.h) * 0.22));
  let x0 = pane.x;
  let y0 = pane.y;
  let x1 = pane.x + pane.w;
  let y1 = pane.y + pane.h;
  if (layout === "grid") {
    x0 = pane.x + Math.floor(pane.w * 0.35);
    x1 = pane.x + Math.ceil(pane.w * 0.65);
    y0 = pane.y + Math.floor(pane.h * 0.35);
    y1 = pane.y + Math.ceil(pane.h * 0.65);
  } else if (layout === "rows") {
    x0 = pane.x + Math.floor(pane.w * 0.35);
    x1 = pane.x + Math.ceil(pane.w * 0.65);
    y0 = pane.y + pane.h - band;
  } else {
    y0 = pane.y + pane.h - band;
    x0 = pane.x + Math.floor(pane.w * 0.2);
    x1 = pane.x + Math.ceil(pane.w * 0.8);
  }
  let r = 0,
    g = 0,
    b = 0,
    n = 0;
  for (let py = y0; py < y1; py += 2) {
    for (let px = x0; px < x1; px += 2) {
      const i = (py * w + px) * 4;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      n++;
    }
  }
  if (!n) return { r: 200, g: 120, b: 60 };
  return { r: r / n, g: g / n, b: b / n };
}

/** Frosted pane grid: sharp base, per-pane blurred layer + tinted gradient overlay. */
function renderFractalGlass(
  out: CanvasRenderingContext2D,
  src: CanvasRenderingContext2D,
  w: number,
  h: number,
  p: Params
) {
  const layout = str(p, "layout", "columns");
  const count = num(p, "count", 12);
  const blurPx = Math.min(30, Math.max(0, num(p, "blurAmount", 12)));
  const opacity = num(p, "opacity", 85) / 100;
  const gradStr = num(p, "gradientStrength", 70) / 100;
  const variation = num(p, "variation", 25);
  const showEdges = p.showEdges !== false;
  const source = resolveEffectSource(out, src, w, h);
  const img = src.getImageData(0, 0, w, h);
  const data = img.data;

  const seed = 42;
  const panes = fractalPanes(w, h, layout, count, variation, seed);

  out.save();
  out.setTransform(1, 0, 0, 1, 0, 0);
  out.clearRect(0, 0, w, h);
  out.drawImage(source, 0, 0, w, h);
  out.restore();

  let blurred: HTMLCanvasElement | null = null;
  if (blurPx > 0 && opacity > 0) {
    if (!fractalBlurBuf) fractalBlurBuf = document.createElement("canvas");
    if (fractalBlurBuf.width !== w || fractalBlurBuf.height !== h) {
      fractalBlurBuf.width = w;
      fractalBlurBuf.height = h;
    }
    const bCtx = fractalBlurBuf.getContext("2d")!;
    bCtx.clearRect(0, 0, w, h);
    bCtx.filter = `blur(${blurPx}px)`;
    bCtx.drawImage(source, 0, 0, w, h);
    bCtx.filter = "none";
    blurred = fractalBlurBuf;
  }

  for (const pane of panes) {
    const { r, g, b } = samplePaneColor(data, w, h, pane, layout);
    const shimmer = 0;

    out.save();
    out.beginPath();
    out.rect(pane.x, pane.y, pane.w, pane.h);
    out.clip();

    if (blurred) {
      out.drawImage(blurred, 0, 0, w, h);
    }

    const alpha = opacity * (gradStr * (0.35 + 0.65 * (1 + shimmer)));
    if (alpha > 0.01) {
      const { dark, mid } = paneGradientRgb({ r, g, b }, gradStr);
      const edgeA = Math.min(1, alpha * (0.55 + gradStr * 0.45));
      const midA = Math.min(1, alpha * (0.75 + gradStr * 0.25));
      let grad: CanvasGradient;
      if (layout === "rows") {
        grad = out.createLinearGradient(pane.x, pane.y, pane.x + pane.w, pane.y);
      } else {
        grad = out.createLinearGradient(pane.x, pane.y, pane.x, pane.y + pane.h);
      }
      grad.addColorStop(0, `rgba(${dark},${edgeA})`);
      grad.addColorStop(0.5, `rgba(${mid},${midA})`);
      grad.addColorStop(1, `rgba(${dark},${edgeA})`);
      out.fillStyle = grad;
      out.fillRect(pane.x, pane.y, pane.w, pane.h);
    }

    out.restore();

    if (showEdges) {
      out.save();
      out.strokeStyle = "rgba(255,255,255,0.18)";
      out.lineWidth = 1;
      out.strokeRect(pane.x + 0.5, pane.y + 0.5, pane.w - 1, pane.h - 1);
      out.restore();
    }
  }

  out.globalAlpha = 1;
}

function renderAscii(
  out: CanvasRenderingContext2D,
  data: Uint8ClampedArray,
  w: number,
  h: number,
  ctx: RenderContext
) {
  const p = ctx.params;
  const cell = num(p, "cellSize", 10);
  const gap = num(p, "gap", 0);
  const step = cell + gap;
  const contrast = num(p, "contrast", 50);
  out.fillStyle = ctx.bgColor;
  out.fillRect(0, 0, w, h);
  out.font = `${cell}px monospace`;
  out.textAlign = "center";
  out.textBaseline = "middle";
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const fw = getFocalWeight((x + cell / 2) / w, (y + cell / 2) / h, ctx.focalPoint, ctx.useFocalPoint);
      if (ctx.useFocalPoint && fw < 0.12) continue;
      const { r, g, b, l } = sampleCell(data, w, h, x, y, cell, contrast);
      const mappedL = l * fw;
      out.globalAlpha = fw;
      out.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
      out.fillText(charFromLuma(mappedL), x + cell / 2, y + cell / 2);
    }
  }
  out.globalAlpha = 1;
}

let effectSrcBuf: HTMLCanvasElement | null = null;

function effectSourceCanvas(src: HTMLCanvasElement, w: number, h: number): HTMLCanvasElement {
  if (!effectSrcBuf) effectSrcBuf = document.createElement("canvas");
  if (effectSrcBuf.width !== w || effectSrcBuf.height !== h) {
    effectSrcBuf.width = w;
    effectSrcBuf.height = h;
  }
  effectSrcBuf.getContext("2d")!.drawImage(src, 0, 0, w, h);
  return effectSrcBuf;
}

function resolveEffectSource(
  out: CanvasRenderingContext2D,
  src: CanvasRenderingContext2D,
  w: number,
  h: number
): HTMLCanvasElement {
  const srcCanvas = src.canvas;
  return out.canvas === srcCanvas ? effectSourceCanvas(srcCanvas, w, h) : srcCanvas;
}

let blurEffectBuf: HTMLCanvasElement | null = null;
let motionBlurBuf: HTMLCanvasElement | null = null;

/** Lerp sharp vs blurred: t=0 sharp, t=1 fully blurred (no overlay on sharp). */
function compositeSharpBlur(
  out: CanvasRenderingContext2D,
  sharp: CanvasImageSource,
  blurred: CanvasImageSource,
  w: number,
  h: number,
  t: number
) {
  out.save();
  out.setTransform(1, 0, 0, 1, 0, 0);
  out.clearRect(0, 0, w, h);
  if (t <= 0) {
    out.drawImage(sharp, 0, 0, w, h);
    out.restore();
    return;
  }
  if (t >= 1) {
    out.drawImage(blurred, 0, 0, w, h);
    out.restore();
    return;
  }
  out.globalAlpha = 1 - t;
  out.drawImage(sharp, 0, 0, w, h);
  out.globalAlpha = t;
  out.drawImage(blurred, 0, 0, w, h);
  out.globalAlpha = 1;
  out.restore();
}

function renderBlur(
  out: CanvasRenderingContext2D,
  src: CanvasRenderingContext2D,
  w: number,
  h: number,
  p: Params
) {
  const radius = Math.min(30, Math.max(0, num(p, "blurAmount", 8)));
  const opacity = num(p, "opacity", 100) / 100;
  const source = resolveEffectSource(out, src, w, h);
  if (radius <= 0 || opacity <= 0) {
    out.save();
    out.setTransform(1, 0, 0, 1, 0, 0);
    out.clearRect(0, 0, w, h);
    out.drawImage(source, 0, 0, w, h);
    out.restore();
    return;
  }
  if (!blurEffectBuf) blurEffectBuf = document.createElement("canvas");
  if (blurEffectBuf.width !== w || blurEffectBuf.height !== h) {
    blurEffectBuf.width = w;
    blurEffectBuf.height = h;
  }
  const bCtx = blurEffectBuf.getContext("2d")!;
  bCtx.clearRect(0, 0, w, h);
  bCtx.filter = `blur(${radius}px)`;
  bCtx.drawImage(source, 0, 0, w, h);
  bCtx.filter = "none";
  compositeSharpBlur(out, source, blurEffectBuf, w, h, opacity);
}

function streakBlurRegion(
  mCtx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  x: number,
  y: number,
  bw: number,
  bh: number,
  blurLen: number,
  cos: number,
  sin: number
) {
  if (blurLen < 0.5) {
    mCtx.drawImage(source, x, y, bw, bh, x, y, bw, bh);
    return;
  }
  const samples = Math.min(32, Math.max(4, Math.round(blurLen / 2)));
  const step = blurLen / (samples - 1);
  mCtx.save();
  mCtx.beginPath();
  mCtx.rect(x, y, bw, bh);
  mCtx.clip();
  for (let i = 0; i < samples; i++) {
    const t = i - (samples - 1) / 2;
    const dx = cos * t * step;
    const dy = sin * t * step;
    mCtx.globalCompositeOperation = "source-over";
    mCtx.globalAlpha = 1 / samples;
    mCtx.drawImage(source, x + dx, y + dy, bw, bh, x, y, bw, bh);
  }
  mCtx.globalCompositeOperation = "source-over";
  mCtx.globalAlpha = 1;
  mCtx.restore();
}

function renderMotionBlur(
  out: CanvasRenderingContext2D,
  src: CanvasRenderingContext2D,
  w: number,
  h: number,
  ctx: RenderContext
) {
  const p = ctx.params;
  const angle = (num(p, "angle", 0) * Math.PI) / 180;
  const length = Math.min(300, Math.max(0, num(p, "length", 24)));
  const opacity = num(p, "opacity", 100) / 100;
  const source = resolveEffectSource(out, src, w, h);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  if (length <= 0 || opacity <= 0) {
    out.save();
    out.setTransform(1, 0, 0, 1, 0, 0);
    out.clearRect(0, 0, w, h);
    out.drawImage(source, 0, 0, w, h);
    out.restore();
    return;
  }

  if (!motionBlurBuf) motionBlurBuf = document.createElement("canvas");
  if (motionBlurBuf.width !== w || motionBlurBuf.height !== h) {
    motionBlurBuf.width = w;
    motionBlurBuf.height = h;
  }
  const mCtx = motionBlurBuf.getContext("2d")!;
  mCtx.clearRect(0, 0, w, h);

  if (!ctx.useFocalPoint) {
    streakBlurRegion(mCtx, source, 0, 0, w, h, length, cos, sin);
  } else {
    const block = Math.max(8, Math.ceil(Math.min(w, h) / 4));
    for (let y = 0; y < h; y += block) {
      for (let x = 0; x < w; x += block) {
        const bw = Math.min(block, w - x);
        const bh = Math.min(block, h - y);
        const fw = getFocalWeight(
          (x + bw / 2) / w,
          (y + bh / 2) / h,
          ctx.focalPoint,
          ctx.useFocalPoint
        );
        streakBlurRegion(mCtx, source, x, y, bw, bh, length * fw, cos, sin);
      }
    }
  }

  compositeSharpBlur(out, source, motionBlurBuf, w, h, opacity);
}

function renderDither(
  out: CanvasRenderingContext2D,
  data: Uint8ClampedArray,
  w: number,
  h: number,
  p: Params
) {
  const cell = num(p, "cellSize", 4);
  const levels = num(p, "levels", 4);
  const contrast = num(p, "contrast", 50);
  for (let y = 0; y < h; y += cell) {
    for (let x = 0; x < w; x += cell) {
      const { r, g, b, l } = sampleCell(data, w, h, x, y, cell, contrast);
      const bx = Math.floor(x / cell) % 4;
      const by = Math.floor(y / cell) % 4;
      const thresh = (bayer4[by][bx] / 16) * 255;
      const q = Math.floor(((l + thresh) / 255) * levels) / levels;
      const v = q * 255;
      out.fillStyle = `rgb(${v | 0},${v | 0},${v | 0})`;
      out.fillRect(x, y, cell, cell);
      void r;
      void g;
      void b;
    }
  }
}

/** Deterministic seed from glitch params — stable while paused, updates when sliders move. */
function glitchStaticSeed(p: Params) {
  const offset = num(p, "offset", 12);
  const sliceH = num(p, "sliceHeight", 8);
  const intensity = num(p, "intensity", 50);
  return ((offset * 17 + sliceH * 31 + Math.floor(intensity)) % 997) + 1;
}

function glitchHash(x: number, y: number, seed: number) {
  return ((x * 374761393 + y * 668265263 + seed * 982451653) >>> 0) % 10000;
}

function renderGlitch(
  out: CanvasRenderingContext2D,
  data: Uint8ClampedArray,
  w: number,
  h: number,
  ctx: RenderContext
) {
  const p = ctx.params;
  const offset = num(p, "offset", 12);
  const sliceH = num(p, "sliceHeight", 8);
  const intensity = num(p, "intensity", 50) / 100;
  if (intensity <= 0) {
    out.putImageData(new ImageData(new Uint8ClampedArray(data), w, h), 0, 0);
    return;
  }

  const staticSeed = glitchStaticSeed(p);
  const rgbShift = Math.max(1, Math.round(offset * 0.5));
  const block = Math.max(4, sliceH * 2);

  const outData = new Uint8ClampedArray(data);
  const amt = intensity;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const h0 = glitchHash(x, y, staticSeed);
      const baseRs = (h0 % (rgbShift * 2 + 1)) - rgbShift;
      const baseBs = (glitchHash(x + 3, y + 7, staticSeed) % (rgbShift * 2 + 1)) - rgbShift;
      const rs = Math.round(baseRs * amt);
      const bs = Math.round(baseBs * amt);
      const rx = Math.min(w - 1, Math.max(0, x + rs));
      const bx = Math.min(w - 1, Math.max(0, x + bs));
      const ri = (y * w + rx) * 4;
      const bi = (y * w + bx) * 4;
      outData[i] = data[ri];
      outData[i + 1] = data[i + 1];
      outData[i + 2] = data[bi + 2];
      if (glitchHash(x, y, staticSeed + 1) % 100 < intensity * 18) {
        const n = (glitchHash(x + y, y, staticSeed) % 41) - 20;
        outData[i] = Math.min(255, Math.max(0, outData[i] + n * amt));
        outData[i + 1] = Math.min(255, Math.max(0, outData[i + 1] + n * amt * 0.7));
        outData[i + 2] = Math.min(255, Math.max(0, outData[i + 2] + n * amt * 0.9));
      }
    }
  }

  out.putImageData(new ImageData(outData, w, h), 0, 0);

  for (let by = 0; by < h; by += block) {
    for (let bx = 0; bx < w; bx += block) {
      const h0 = glitchHash(bx, by, staticSeed);
      if (h0 % 100 > 25 + (1 - intensity) * 50) continue;
      const baseDx = ((h0 % (offset + 1)) - offset / 2) * amt;
      const baseDy = ((glitchHash(bx, by + 1, staticSeed) % (offset + 1)) - offset / 2) * amt;
      const dx = Math.round(baseDx);
      const dy = Math.round(baseDy);
      const slice = out.getImageData(bx, by, Math.min(block, w - bx), Math.min(block, h - by));
      out.putImageData(slice, bx + dx, by + dy);
    }
  }

  for (let y = 0; y < h; y += sliceH) {
    const h0 = glitchHash(0, y, staticSeed);
    if (h0 % 100 > 20 + (1 - intensity) * 55) continue;
    const baseShift = ((h0 % (offset * 2 + 1)) - offset) * amt;
    const shift = Math.round(baseShift);
    const slice = out.getImageData(0, y, w, Math.min(sliceH, h - y));
    out.putImageData(slice, shift, y);
  }
}

function renderVintage(
  out: CanvasRenderingContext2D,
  data: Uint8ClampedArray,
  w: number,
  h: number,
  ctx: RenderContext
) {
  const p = ctx.params;
  const sepia = num(p, "sepia", 70) / 100;
  const grain = num(p, "grain", 30) / 100;
  const vignette = num(p, "vignette", 40) / 100;
  const outData = new Uint8ClampedArray(data.length);
  const cx = w / 2;
  const cy = h / 2;
  const maxD = Math.sqrt(cx * cx + cy * cy);
  for (let i = 0; i < data.length; i += 4) {
    const px = (i / 4) % w;
    const py = Math.floor(i / 4 / w);
    const fw = getFocalWeight(px / w, py / h, ctx.focalPoint, ctx.useFocalPoint);
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];
    const tr = 0.393 * r + 0.769 * g + 0.189 * b;
    const tg = 0.349 * r + 0.686 * g + 0.168 * b;
    const tb = 0.272 * r + 0.534 * g + 0.131 * b;
    r = r * (1 - sepia * fw) + tr * sepia * fw;
    g = g * (1 - sepia * fw) + tg * sepia * fw;
    b = b * (1 - sepia * fw) + tb * sepia * fw;
    const d = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2) / maxD;
    const v = 1 - vignette * d * d * fw;
    r *= v;
    g *= v;
    b *= v;
    if (grain > 0) {
      const n = ((px * 17 + py * 31 + i) % 20) / 20 - 0.5;
      const grainAmt = grain * fw;
      r += n * grainAmt * 40;
      g += n * grainAmt * 40;
      b += n * grainAmt * 40;
    }
    outData[i] = r;
    outData[i + 1] = g;
    outData[i + 2] = b;
    outData[i + 3] = 255;
  }
  out.putImageData(new ImageData(outData, w, h), 0, 0);
}

function renderCHtone(
  out: CanvasRenderingContext2D,
  data: Uint8ClampedArray,
  w: number,
  h: number,
  p: Params,
  bgColor: string
) {
  const cell = num(p, "cellSize", 14);
  const opacity = num(p, "opacity", 90) / 100;
  const channels = [
    { dx: 0, dy: 0, c: "r" },
    { dx: cell * 0.3, dy: 0, c: "g" },
    { dx: 0, dy: cell * 0.3, c: "b" },
  ];
  out.fillStyle = bgColor;
  out.fillRect(0, 0, w, h);
  out.globalAlpha = opacity;
  for (const ch of channels) {
    for (let y = 0; y < h; y += cell) {
      for (let x = 0; x < w; x += cell) {
        const { r, g, b, l } = sampleCell(data, w, h, x, y, cell, 50);
        const rad = (cell / 2) * (1 - l / 255);
        const color =
          ch.c === "r" ? `rgb(${r | 0},0,0)` : ch.c === "g" ? `rgb(0,${g | 0},0)` : `rgb(0,0,${b | 0})`;
        out.fillStyle = color;
        out.beginPath();
        out.arc(x + cell / 2 + ch.dx, y + cell / 2 + ch.dy, rad, 0, Math.PI * 2);
        out.fill();
      }
    }
  }
  out.globalAlpha = 1;
}

function renderImgTrack(
  out: CanvasRenderingContext2D,
  data: Uint8ClampedArray,
  w: number,
  h: number,
  p: Params
) {
  const thresh = num(p, "edgeThresh", 80);
  const box = num(p, "boxSize", 24);
  const maxR = num(p, "maxRegions", 6);
  const gray = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      const l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const i2 = (y * w + x + 1) * 4;
      const l2 = 0.299 * data[i2] + 0.587 * data[i2 + 1] + 0.114 * data[i2 + 2];
      const i3 = ((y + 1) * w + x) * 4;
      const l3 = 0.299 * data[i3] + 0.587 * data[i3 + 1] + 0.114 * data[i3 + 2];
      gray[y * w + x] = Math.abs(l - l2) + Math.abs(l - l3);
    }
  }
  const regions: { x: number; y: number; score: number }[] = [];
  for (let y = 0; y < h; y += box) {
    for (let x = 0; x < w; x += box) {
      let s = 0,
        n = 0;
      for (let py = y; py < Math.min(h, y + box); py += 2) {
        for (let px = x; px < Math.min(w, x + box); px += 2) {
          s += gray[py * w + px];
          n++;
        }
      }
      if (n && s / n > thresh) regions.push({ x, y, score: s / n });
    }
  }
  regions.sort((a, b) => b.score - a.score);
  out.putImageData(new ImageData(new Uint8ClampedArray(data), w, h), 0, 0);
  out.strokeStyle = "#00d4ff";
  out.lineWidth = 2;
  for (const r of regions.slice(0, maxR)) {
    out.strokeRect(r.x, r.y, box, box);
  }
}

function renderStage(
  out: CanvasRenderingContext2D,
  data: Uint8ClampedArray,
  w: number,
  h: number,
  ctx: RenderContext
) {
  const p = ctx.params;
  const spot = num(p, "spotSize", 55) / 100;
  const darkness = num(p, "darkness", 70) / 100;
  const warmth = num(p, "warmth", 40) / 100;
  const cx = w / 2;
  const cy = h / 2;
  const maxR = Math.max(w, h) * spot;
  const outData = new Uint8ClampedArray(data);
  for (let i = 0; i < data.length; i += 4) {
    const px = (i / 4) % w;
    const py = Math.floor(i / 4 / w);
    const fw = getFocalWeight(px / w, py / h, ctx.focalPoint, ctx.useFocalPoint);
    const d = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
    const falloff = Math.min(1, d / maxR);
    const dim = 1 - darkness * falloff * falloff * fw;
    let r = data[i] * dim;
    let g = data[i + 1] * dim;
    let b = data[i + 2] * dim;
    r += warmth * 30 * (1 - falloff) * fw;
    g += warmth * 10 * (1 - falloff) * fw;
    outData[i] = r;
    outData[i + 1] = g;
    outData[i + 2] = b;
  }
  out.putImageData(new ImageData(outData, w, h), 0, 0);
}

export function cloneImageData(data: Uint8ClampedArray): Uint8ClampedArray {
  return new Uint8ClampedArray(data);
}
