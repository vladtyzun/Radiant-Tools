import type { MediaRect } from "./layout";
import { normToMedia } from "./layout";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

export type TrackRegion = { x: number; y: number; score: number };

const FINGERTIPS = [4, 8, 12, 16, 20];
const SPREAD_THRESHOLD = 0.12;

export function drawMotionRegions(
  ctx: CanvasRenderingContext2D,
  regions: TrackRegion[],
  block: number,
  color: string,
  style: string,
  renderW: number,
  renderH: number,
  rect: MediaRect
) {
  const sx = rect.w / renderW;
  const sy = rect.h / renderH;
  ctx.strokeStyle = color;
  ctx.fillStyle = color + "33";
  ctx.lineWidth = Math.max(1, 2 * Math.min(sx, sy));
  for (const r of regions) {
    const x = rect.x + r.x * sx;
    const y = rect.y + r.y * sy;
    const bw = block * sx;
    const bh = block * sy;
    if (style === "solid") {
      ctx.fillRect(x, y, bw, bh);
    } else {
      ctx.setLineDash(style === "dash" ? [6, 4] : style === "dot" ? [2, 4] : []);
      if (style === "frame" || style === "dash" || style === "dot") {
        ctx.strokeRect(x + 1, y + 1, bw - 2, bh - 2);
      }
    }
  }
  ctx.setLineDash([]);
}

export function drawHandSkeleton(
  ctx: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[],
  connections: { start: number; end: number }[],
  rect: MediaRect,
  mirrorX: boolean,
  lineColor: string,
  lineWidth: number,
  drawSpread: boolean
) {
  if (!landmarks.length) return;
  const map = (lm: NormalizedLandmark) => normToMedia(lm.x, lm.y, rect, mirrorX);
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  for (const c of connections) {
    const a = landmarks[c.start];
    const b = landmarks[c.end];
    if (!a || !b) continue;
    const p0 = map(a);
    const p1 = map(b);
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
  }
  if (drawSpread) {
    const tips = FINGERTIPS.map((i) => landmarks[i]).filter(Boolean) as NormalizedLandmark[];
    const scale = Math.min(rect.w, rect.h);
    const thresh = SPREAD_THRESHOLD * scale;
    ctx.strokeStyle = lineColor + "aa";
    for (let i = 0; i < tips.length; i++) {
      for (let j = i + 1; j < tips.length; j++) {
        const dx = (tips[i].x - tips[j].x) * rect.w;
        const dy = (tips[i].y - tips[j].y) * rect.h;
        if (Math.hypot(dx, dy) > thresh) {
          const p0 = map(tips[i]);
          const p1 = map(tips[j]);
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.stroke();
        }
      }
    }
  }
}

/** Diamond eye markers (distinct from rectangular motion boxes). */
export function drawEyeHighlights(
  ctx: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[],
  eyeIndices: number[],
  rect: MediaRect,
  mirrorX: boolean,
  color: string,
  sizeScale: number
) {
  if (!landmarks.length || !eyeIndices.length) return;
  const scale = Math.min(rect.w, rect.h) * 0.018 * (sizeScale / 50);
  ctx.strokeStyle = color;
  ctx.fillStyle = color + "44";
  ctx.lineWidth = Math.max(1, scale * 0.35);
  for (const idx of eyeIndices) {
    const lm = landmarks[idx];
    if (!lm) continue;
    const { x, y } = normToMedia(lm.x, lm.y, rect, mirrorX);
    const r = scale;
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r, y);
    ctx.lineTo(x, y + r);
    ctx.lineTo(x - r, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.35, r * 0.85, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}
