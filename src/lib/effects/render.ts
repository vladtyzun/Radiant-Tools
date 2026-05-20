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
  time: number;
  animating: boolean;
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
  // Glass/blur read src canvas; skip bg fill so in-place src (sample canvas) stays intact.
  if (ctx.effectId === "glass") {
    renderGlass(out, src.canvas, w, h, ctx.params, ctx.time, ctx.animating);
    return;
  }
  if (ctx.effectId === "blur") {
    renderBlur(out, src, w, h, ctx.params);
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
      renderAscii(out, data, w, h, ctx.params, ctx.bgColor);
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

function renderGlass(
  out: CanvasRenderingContext2D,
  srcCanvas: HTMLCanvasElement,
  w: number,
  h: number,
  p: Params,
  time: number,
  animating: boolean
) {
  const tile = num(p, "tileSize", 23);
  const turns = num(p, "spiralTurns", 10);
  const intensity = turns / 20;
  const src =
    out.canvas === srcCanvas ? glassSourceCanvas(srcCanvas, w, h) : srcCanvas;
  if (intensity <= 0) {
    out.drawImage(src, 0, 0, w, h);
    return;
  }
  const distort = (num(p, "distortion", 55) / 100) * intensity;
  const opacity = num(p, "opacity", 100) / 100;
  const speed = num(p, "speed", 25) / 100;
  const cx = w / 2;
  const cy = h / 2;
  const phase = animating ? time * 0.001 * speed * 10 : 0;

  out.globalAlpha = opacity;
  for (let y = 0; y < h; y += tile) {
    for (let x = 0; x < w; x += tile) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angle =
        Math.atan2(dy, dx) + phase + (dist / Math.max(w, h)) * turns * Math.PI * 2;
      const offset = dist * distort * 0.15;
      const sx = cx + Math.cos(angle) * (dist + offset) - tile / 2;
      const sy = cy + Math.sin(angle) * (dist + offset) - tile / 2;
      out.drawImage(src, sx, sy, tile, tile, x, y, tile, tile);
    }
  }
  out.globalAlpha = 1;
}

function renderAscii(
  out: CanvasRenderingContext2D,
  data: Uint8ClampedArray,
  w: number,
  h: number,
  p: Params,
  bgColor: string
) {
  const cell = num(p, "cellSize", 10);
  const gap = num(p, "gap", 0);
  const step = cell + gap;
  const contrast = num(p, "contrast", 50);
  out.fillStyle = bgColor;
  out.fillRect(0, 0, w, h);
  out.font = `${cell}px monospace`;
  out.textAlign = "center";
  out.textBaseline = "middle";
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const { r, g, b, l } = sampleCell(data, w, h, x, y, cell, contrast);
      out.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
      out.fillText(charFromLuma(l), x + cell / 2, y + cell / 2);
    }
  }
}

function renderBlur(
  out: CanvasRenderingContext2D,
  src: CanvasRenderingContext2D,
  w: number,
  h: number,
  p: Params
) {
  const cell = num(p, "cellSize", 8);
  const blur = num(p, "blurAmount", 4);
  const opacity = num(p, "opacity", 100) / 100;
  out.globalAlpha = opacity;
  for (let y = 0; y < h; y += cell) {
    for (let x = 0; x < w; x += cell) {
      let r = 0,
        g = 0,
        b = 0,
        n = 0;
      for (let oy = -blur; oy <= blur; oy++) {
        for (let ox = -blur; ox <= blur; ox++) {
          const px = Math.min(w - 1, Math.max(0, x + ox * cell));
          const py = Math.min(h - 1, Math.max(0, y + oy * cell));
          const d = src.getImageData(px, py, 1, 1).data;
          r += d[0];
          g += d[1];
          b += d[2];
          n++;
        }
      }
      out.fillStyle = `rgb(${r / n | 0},${g / n | 0},${b / n | 0})`;
      out.fillRect(x, y, cell, cell);
    }
  }
  out.globalAlpha = 1;
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
  const animFrame = ctx.animating ? Math.floor(ctx.time / 80) : 0;
  const t = ctx.animating ? ctx.time * 0.001 : 0;
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
      const animRs = ctx.animating ? Math.round(Math.sin(t * 9 + y * 0.03 + animFrame) * offset * 0.35) : 0;
      const animBs = ctx.animating ? Math.round(Math.cos(t * 7 + x * 0.03 + animFrame) * offset * 0.35) : 0;
      const rs = Math.round((baseRs + animRs) * amt);
      const bs = Math.round((baseBs + animBs) * amt);
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
      const animDx = ctx.animating ? Math.round(Math.sin(t * 5 + bx * 0.02 + animFrame) * offset * 0.5) : 0;
      const animDy = ctx.animating ? Math.round(Math.cos(t * 4 + by * 0.02 + animFrame) * offset * 0.4) : 0;
      const dx = Math.round(baseDx + animDx);
      const dy = Math.round(baseDy + animDy);
      const slice = out.getImageData(bx, by, Math.min(block, w - bx), Math.min(block, h - by));
      out.putImageData(slice, bx + dx, by + dy);
    }
  }

  for (let y = 0; y < h; y += sliceH) {
    const h0 = glitchHash(0, y, staticSeed);
    if (h0 % 100 > 20 + (1 - intensity) * 55) continue;
    const baseShift = ((h0 % (offset * 2 + 1)) - offset) * amt;
    const animShift = ctx.animating ? Math.round(Math.sin(t * 6 + y * 0.04 + animFrame) * offset * 0.8) : 0;
    const shift = Math.round(baseShift + animShift);
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
      const n = ((px * 17 + py * 31 + i + Math.floor(ctx.time * 0.05)) % 20) / 20 - 0.5;
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
  const drift = ctx.animating ? Math.sin(ctx.time * 0.001) * w * 0.06 : 0;
  const cx = w / 2 + drift;
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
