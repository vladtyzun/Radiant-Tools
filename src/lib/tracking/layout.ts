/** Letterboxed media region inside a canvas (pixel coords). */
export type MediaRect = { x: number; y: number; w: number; h: number };

export function fitToMaxEdge(
  sourceW: number,
  sourceH: number,
  maxEdge: number
): { w: number; h: number } {
  if (sourceW <= 0 || sourceH <= 0) return { w: maxEdge, h: maxEdge };
  const scale = Math.min(1, maxEdge / Math.max(sourceW, sourceH));
  return {
    w: Math.max(1, Math.round(sourceW * scale)),
    h: Math.max(1, Math.round(sourceH * scale)),
  };
}

/** Max preview area from viewport (sidebar + padding). */
export function getLayoutViewport(
  container: HTMLElement | null,
  sidebarOffset = 300,
  verticalPad = 32
): { w: number; h: number } {
  const vh =
    typeof window !== "undefined"
      ? Math.max(1, window.innerHeight - verticalPad)
      : 720;
  if (!container) {
    const vw =
      typeof window !== "undefined"
        ? Math.max(1, window.innerWidth - sidebarOffset)
        : 960;
    return { w: vw, h: vh };
  }
  const cw = container.clientWidth;
  const ch = container.clientHeight;
  if (cw > 0 && ch > 0) {
    return { w: cw, h: Math.min(ch, vh) };
  }
  const rect = container.getBoundingClientRect();
  const vw =
    typeof window !== "undefined"
      ? Math.max(1, window.innerWidth - sidebarOffset)
      : 960;
  const w = cw > 0 ? cw : rect.width > 0 ? rect.width : vw;
  const h = ch > 0 ? ch : rect.height > 0 ? rect.height : vh;
  return {
    w: Math.max(1, w),
    h: Math.max(1, Math.min(h, vh)),
  };
}

/** CSS object-fit: contain — media size inside a container (px). */
export function fitContain(
  containerW: number,
  containerH: number,
  sourceW: number,
  sourceH: number
): { w: number; h: number } {
  if (containerW <= 0 || containerH <= 0 || sourceW <= 0 || sourceH <= 0) {
    return { w: 0, h: 0 };
  }
  const mediaAspect = sourceW / sourceH;
  const containerAspect = containerW / containerH;
  if (mediaAspect > containerAspect) {
    const w = Math.round(containerW);
    return { w, h: Math.max(1, Math.round(w / mediaAspect)) };
  }
  const h = Math.round(containerH);
  return { w: Math.max(1, Math.round(h * mediaAspect)), h };
}

/** Fit source aspect ratio inside canvas; pillarbox/letterbox as needed. */
export function getLetterboxRect(
  canvasW: number,
  canvasH: number,
  sourceW: number,
  sourceH: number
): MediaRect {
  if (sourceW <= 0 || sourceH <= 0) {
    return { x: 0, y: 0, w: canvasW, h: canvasH };
  }
  const scale = Math.min(canvasW / sourceW, canvasH / sourceH);
  const w = Math.round(sourceW * scale);
  const h = Math.round(sourceH * scale);
  return {
    x: Math.round((canvasW - w) / 2),
    y: Math.round((canvasH - h) / 2),
    w,
    h,
  };
}

/** Viewport client coords → normalized [0,1] within letterboxed media (clamped). */
export function clientToMediaNorm(
  clientX: number,
  clientY: number,
  canvas: HTMLCanvasElement,
  media: MediaRect
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0 || media.w <= 0 || media.h <= 0) {
    return { x: 0.5, y: 0.5 };
  }
  const px = ((clientX - rect.left) / rect.width) * canvas.width;
  const py = ((clientY - rect.top) / rect.height) * canvas.height;
  return {
    x: Math.min(1, Math.max(0, (px - media.x) / media.w)),
    y: Math.min(1, Math.max(0, (py - media.y) / media.h)),
  };
}

/** Normalized landmark [0,1] → display pixel in letterboxed region. */
export function normToMedia(
  nx: number,
  ny: number,
  rect: MediaRect,
  mirrorX: boolean
): { x: number; y: number } {
  const x = mirrorX ? 1 - nx : nx;
  return { x: rect.x + x * rect.w, y: rect.y + ny * rect.h };
}
