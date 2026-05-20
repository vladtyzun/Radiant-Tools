import type { AlgorithmMode, Params } from "../types";

const CHARSET = " .':-=*+oO#@%";

export function luminance(r: number, g: number, b: number) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export function applyContrast(v: number, contrast: number) {
  const c = (contrast / 50) * 1.5;
  return Math.min(255, Math.max(0, ((v - 128) * c + 128)));
}

export function sampleCell(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  x: number,
  y: number,
  size: number,
  contrast: number
) {
  let r = 0,
    g = 0,
    b = 0,
    n = 0;
  const x2 = Math.min(w, x + size);
  const y2 = Math.min(h, y + size);
  for (let py = y; py < y2; py += 2) {
    for (let px = x; px < x2; px += 2) {
      const i = (py * w + px) * 4;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      n++;
    }
  }
  if (!n) return { r: 0, g: 0, b: 0, l: 0 };
  r = applyContrast(r / n, contrast);
  g = applyContrast(g / n, contrast);
  b = applyContrast(b / n, contrast);
  return { r, g, b, l: luminance(r, g, b) };
}

export function shapeScaleFromMode(
  l: number,
  mode: AlgorithmMode,
  effectPower: number,
  shapeScale: number,
  invert: boolean
) {
  const base = shapeScale / 100;
  const power = effectPower / 100;
  if (mode === "flat") return base;
  const dark = (255 - l) / 255;
  const light = l / 255;
  if (mode === "halftone") {
    const t = invert ? light : dark;
    return base * (0.05 + t * power);
  }
  const t = invert ? dark : light;
  return base * (0.05 + t * power);
}

export function fillForAlgorithm(
  mode: AlgorithmMode,
  l: number,
  r: number,
  g: number,
  b: number,
  bgColor: string
) {
  if (mode !== "inverse") return `rgb(${r | 0},${g | 0},${b | 0})`;
  return l > 128 ? bgColor : `rgb(${r | 0},${g | 0},${b | 0})`;
}

export function charFromLuma(l: number) {
  const idx = Math.floor((l / 255) * (CHARSET.length - 1));
  return CHARSET[Math.min(CHARSET.length - 1, idx)];
}

export function num(p: Params, key: string, fallback: number) {
  const v = p[key];
  return typeof v === "number" ? v : fallback;
}

export function bool(p: Params, key: string, fallback: boolean) {
  const v = p[key];
  return typeof v === "boolean" ? v : fallback;
}

export function str(p: Params, key: string, fallback: string) {
  const v = p[key];
  return typeof v === "string" ? v : fallback;
}
