import type { Params } from "../types";
import { num, str } from "./utils";
import type { TrackRegion } from "../tracking/draw";

export function computeMotionRegions(
  data: Uint8ClampedArray,
  prevFrame: Uint8ClampedArray,
  w: number,
  h: number,
  block: number,
  sens: number,
  maxR: number
): TrackRegion[] {
  const regions: TrackRegion[] = [];
  for (let y = 0; y < h; y += block) {
    for (let x = 0; x < w; x += block) {
      let diff = 0,
        n = 0;
      for (let py = y; py < Math.min(h, y + block); py += 2) {
        for (let px = x; px < Math.min(w, x + block); px += 2) {
          const i = (py * w + px) * 4;
          diff += Math.abs(data[i] - prevFrame[i]);
          diff += Math.abs(data[i + 1] - prevFrame[i + 1]);
          diff += Math.abs(data[i + 2] - prevFrame[i + 2]);
          n++;
        }
      }
      const score = n ? diff / n : 0;
      if (score > sens) regions.push({ x, y, score });
    }
  }
  regions.sort((a, b) => b.score - a.score);
  return regions.slice(0, maxR);
}

/** Draw base frame (no boxes) into `out` at render resolution. */
export function renderTrackBase(
  out: CanvasRenderingContext2D,
  data: Uint8ClampedArray,
  w: number,
  h: number,
  invert: boolean
) {
  const sample = document.createElement("canvas");
  sample.width = w;
  sample.height = h;
  const sc = sample.getContext("2d")!;
  sc.putImageData(new ImageData(new Uint8ClampedArray(data), w, h), 0, 0);
  if (invert) {
    out.fillStyle = "#f0f0f0";
    out.fillRect(0, 0, w, h);
  } else {
    out.drawImage(sample, 0, 0);
  }
}

export function readTrackParams(p: Params) {
  return {
    block: num(p, "cellSize", 24),
    sens: num(p, "sensitivity", 60),
    maxR: num(p, "maxRegions", 5),
    color: str(p, "boxColor", "#ffffff"),
    style: str(p, "boxStyle", "frame"),
    invert: !!p.invert,
    trackHands: p.trackHands !== false,
    trackEyes: p.trackEyes !== false,
    handSkeleton: p.handSkeleton !== false,
    skeletonLineWidth: num(p, "skeletonLineWidth", 2),
    skeletonLineColor: str(p, "skeletonLineColor", "") || str(p, "boxColor", "#ffffff"),
    eyeHighlightSize: num(p, "eyeHighlightSize", 50),
    eyeColor: str(p, "eyeColor", "#22d3ee"),
    trackMotion: p.trackMotion !== false,
  };
}
