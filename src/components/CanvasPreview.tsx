"use client";

import { useCallback, useEffect, useImperativeHandle, useRef, forwardRef, useState } from "react";
import { cloneImageData, renderEffect } from "@/lib/effects/render";
import { computeMotionRegions, renderTrackBase, readTrackParams } from "@/lib/effects/track";
import { buildSvg, downloadSvg, rasterFallbackSvg } from "@/lib/exportSvg";
import { drawEyeHighlights, drawHandSkeleton, drawMotionRegions } from "@/lib/tracking/draw";
import {
  fitContain,
  fitToMaxEdge,
  getLayoutViewport,
  getLetterboxRect,
} from "@/lib/tracking/layout";
import type { MediaRect } from "@/lib/tracking/layout";
import {
  detectEyes,
  detectHands,
  disposeTrackModels,
  getTrackMlError,
  initTrackModels,
} from "@/lib/tracking/mediapipeClient";
import type { PatternStore } from "@/hooks/usePatternStore";
import type { ExportFormat } from "@/lib/types";

type Props = PatternStore & {
  imageUrl: string | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  stream: MediaStream | null;
  onReadyChange: (ready: boolean) => void;
  onExportReady?: (fn: (format: ExportFormat) => void) => void;
};

const RENDER_MAX = 1280;
const DISPLAY_MAX = 960;
const ML_INTERVAL_MS = 50;

export type CanvasPreviewHandle = {
  exportFrame: (format: ExportFormat) => void;
};

export const CanvasPreview = forwardRef<CanvasPreviewHandle, Props>(function CanvasPreview(
  {
    effectId,
    params,
    algorithmMode,
    shapeId,
    customPath,
    bgColor,
    sourceMode,
    effectPlaying,
    effectSpeed,
    focalPoint,
    setFocalPoint,
    useFocalPoint,
    videoPlaying,
    videoSpeed,
    imageUrl,
    videoRef,
    stream,
    onReadyChange,
    onExportReady,
    setTrackMlStatus,
  },
  ref
) {
  const displayRef = useRef<HTMLCanvasElement>(null);
  const sampleRef = useRef<HTMLCanvasElement>(null);
  const prevFrameRef = useRef<Uint8ClampedArray | null>(null);
  const rafRef = useRef<number>(0);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const animTimeRef = useRef(0);
  const lastTickRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const intrinsicRef = useRef({ w: 0, h: 0 });
  const mediaRectRef = useRef<MediaRect>({ x: 0, y: 0, w: 1, h: 1 });
  const lastMlRef = useRef(0);
  const mlReadyRef = useRef(false);
  const handsRef = useRef<ReturnType<typeof detectHands>>(null);
  const eyesRef = useRef<ReturnType<typeof detectEyes>>(null);
  const [draggingFocal, setDraggingFocal] = useState(false);
  const drawFrameRef = useRef<(now?: number) => void>(() => {});

  const applyCanvasSizes = useCallback((sourceW: number, sourceH: number) => {
    if (
      !Number.isFinite(sourceW) ||
      !Number.isFinite(sourceH) ||
      sourceW <= 0 ||
      sourceH <= 0
    ) {
      return;
    }
    intrinsicRef.current = { w: sourceW, h: sourceH };
    const render = fitToMaxEdge(sourceW, sourceH, RENDER_MAX);
    const { w: cw, h: ch } = getLayoutViewport(containerRef.current);
    let display = fitToMaxEdge(sourceW, sourceH, DISPLAY_MAX);
    const fitted = fitContain(cw, ch, sourceW, sourceH);
    if (fitted.w > 0 && fitted.h > 0) {
      display = fitToMaxEdge(fitted.w, fitted.h, DISPLAY_MAX);
    }
    if (displayRef.current) {
      displayRef.current.width = display.w;
      displayRef.current.height = display.h;
      displayRef.current.style.removeProperty("width");
      displayRef.current.style.removeProperty("height");
    }
    if (sampleRef.current) {
      sampleRef.current.width = render.w;
      sampleRef.current.height = render.h;
    }
  }, []);

  const blitSampleToDisplay = useCallback(
    (
      dCtx: CanvasRenderingContext2D,
      sampleCanvas: HTMLCanvasElement,
      renderW: number,
      renderH: number,
      displayW: number,
      displayH: number
    ): MediaRect => {
      const intrinsic = intrinsicRef.current;
      const mediaRect = getLetterboxRect(
        displayW,
        displayH,
        intrinsic.w || renderW,
        intrinsic.h || renderH
      );
      mediaRectRef.current = mediaRect;
      dCtx.fillStyle = bgColor;
      dCtx.fillRect(0, 0, displayW, displayH);
      dCtx.drawImage(
        sampleCanvas,
        0,
        0,
        renderW,
        renderH,
        mediaRect.x,
        mediaRect.y,
        mediaRect.w,
        mediaRect.h
      );
      return mediaRect;
    },
    [bgColor]
  );

  const setFocalFromClient = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = displayRef.current;
      if (!canvas?.width) return;
      const rect = canvas.getBoundingClientRect();
      const media = mediaRectRef.current;
      const px = ((clientX - rect.left) / rect.width) * canvas.width;
      const py = ((clientY - rect.top) / rect.height) * canvas.height;
      const x = Math.min(1, Math.max(0, (px - media.x) / media.w));
      const y = Math.min(1, Math.max(0, (py - media.y) / media.h));
      setFocalPoint({ x, y });
    },
    [setFocalPoint]
  );

  const drawTrackFrame = useCallback(
    (
      dCtx: CanvasRenderingContext2D,
      sCtx: CanvasRenderingContext2D,
      renderW: number,
      renderH: number,
      displayW: number,
      displayH: number,
      mirrorX: boolean,
      now: number
    ) => {
      const tp = readTrackParams(params);
      const data = sCtx.getImageData(0, 0, renderW, renderH).data;
      renderTrackBase(sCtx, data, renderW, renderH, tp.invert);

      if (tp.trackMotion && prevFrameRef.current?.length === data.length) {
        const regions = computeMotionRegions(
          data,
          prevFrameRef.current,
          renderW,
          renderH,
          tp.block,
          tp.sens,
          tp.maxR
        );
        drawMotionRegions(sCtx, regions, tp.block, tp.color, tp.style, renderW, renderH, {
          x: 0,
          y: 0,
          w: renderW,
          h: renderH,
        });
      }

      blitSampleToDisplay(dCtx, sCtx.canvas, renderW, renderH, displayW, displayH);
      const mediaRect = mediaRectRef.current;

      const sampleCanvas = sampleRef.current;
      const isVideo = sourceMode === "video" || sourceMode === "webcam";
      if (sampleCanvas && mlReadyRef.current && (tp.trackHands || tp.trackEyes)) {
        if (now - lastMlRef.current >= ML_INTERVAL_MS) {
          lastMlRef.current = now;
          if (tp.trackHands) {
            handsRef.current = detectHands(sampleCanvas, now, isVideo);
          } else handsRef.current = null;
          if (tp.trackEyes) {
            eyesRef.current = detectEyes(sampleCanvas, now, isVideo);
          } else eyesRef.current = null;
        }
        const lw = tp.skeletonLineWidth * Math.min(mediaRect.w / renderW, mediaRect.h / renderH);
        if (tp.trackHands && tp.handSkeleton && handsRef.current) {
          for (const hand of handsRef.current.landmarks) {
            drawHandSkeleton(
              dCtx,
              hand,
              handsRef.current.connections,
              mediaRect,
              mirrorX,
              tp.skeletonLineColor,
              lw,
              true
            );
          }
        }
        if (tp.trackEyes && eyesRef.current) {
          for (const face of eyesRef.current.landmarks) {
            drawEyeHighlights(
              dCtx,
              face,
              eyesRef.current.leftEyeIndices,
              mediaRect,
              mirrorX,
              tp.eyeColor,
              tp.eyeHighlightSize
            );
            drawEyeHighlights(
              dCtx,
              face,
              eyesRef.current.rightEyeIndices,
              mediaRect,
              mirrorX,
              tp.eyeColor,
              tp.eyeHighlightSize
            );
          }
        }
      }

      prevFrameRef.current = cloneImageData(data);
    },
    [params, sourceMode, blitSampleToDisplay]
  );

  const drawFrame = useCallback(
    (now = performance.now()) => {
      const display = displayRef.current;
      const sample = sampleRef.current;
      if (!display || !sample) return;
      const dCtx = display.getContext("2d", { willReadFrequently: true });
      const sCtx = sample.getContext("2d", { willReadFrequently: true });
      if (!dCtx || !sCtx) return;

      const video = videoRef.current;
      let hasSource = false;
      const renderW = sample.width;
      const renderH = sample.height;
      const displayW = display.width;
      const displayH = display.height;
      // Sample buffer is already mirrored for webcam; landmarks match sample space.
      const mirrorX = false;

      if (sourceMode === "image" && imgRef.current?.complete) {
        sCtx.setTransform(1, 0, 0, 1, 0, 0);
        sCtx.drawImage(imgRef.current, 0, 0, renderW, renderH);
        hasSource = true;
      } else if ((sourceMode === "video" || sourceMode === "webcam") && video && video.readyState >= 2) {
        sCtx.setTransform(1, 0, 0, 1, 0, 0);
        if (mirrorX) {
          sCtx.save();
          sCtx.translate(renderW, 0);
          sCtx.scale(-1, 1);
          sCtx.drawImage(video, 0, 0, renderW, renderH);
          sCtx.restore();
        } else {
          sCtx.drawImage(video, 0, 0, renderW, renderH);
        }
        hasSource = true;
      }

      if (!hasSource || !renderW || !renderH) {
        dCtx.fillStyle = "#111";
        dCtx.fillRect(0, 0, displayW || 1, displayH || 1);
        onReadyChange(false);
        return;
      }

      onReadyChange(true);

      if (effectId === "track") {
        drawTrackFrame(dCtx, sCtx, renderW, renderH, displayW, displayH, mirrorX, now);
        return;
      }

      renderEffect(sCtx, sCtx, renderW, renderH, {
        effectId,
        params,
        algorithmMode,
        shapeId,
        customPath,
        bgColor,
        time: animTimeRef.current,
        animating: effectPlaying,
        prevFrame: prevFrameRef.current,
        focalPoint,
        useFocalPoint,
      });
      prevFrameRef.current = cloneImageData(
        sCtx.getImageData(0, 0, renderW, renderH).data
      );
      blitSampleToDisplay(dCtx, sCtx.canvas, renderW, renderH, displayW, displayH);

    },
    [
      effectId,
      params,
      algorithmMode,
      shapeId,
      customPath,
      bgColor,
      sourceMode,
      effectPlaying,
      focalPoint,
      useFocalPoint,
      videoRef,
      onReadyChange,
      drawTrackFrame,
      blitSampleToDisplay,
    ]
  );

  useEffect(() => {
    drawFrameRef.current = drawFrame;
  }, [drawFrame]);

  useEffect(() => {
    if (effectId !== "track") {
      mlReadyRef.current = false;
      handsRef.current = null;
      eyesRef.current = null;
      setTrackMlStatus(null);
      return;
    }
    const isVideo = sourceMode === "video" || sourceMode === "webcam";
    let cancelled = false;
    void initTrackModels(isVideo).then((ok) => {
      if (cancelled) return;
      mlReadyRef.current = ok;
      if (!ok) {
        setTrackMlStatus(
          getTrackMlError() ?? "Hand/eye models unavailable — motion tracking still works"
        );
      } else {
        setTrackMlStatus(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [effectId, sourceMode, setTrackMlStatus]);

  useEffect(() => {
    return () => disposeTrackModels();
  }, []);

  useEffect(() => {
    if (!draggingFocal) return;
    const onMove = (e: MouseEvent) => setFocalFromClient(e.clientX, e.clientY);
    const onTouch = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) setFocalFromClient(t.clientX, t.clientY);
    };
    const end = () => setDraggingFocal(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", end);
    window.addEventListener("touchmove", onTouch, { passive: false });
    window.addEventListener("touchend", end);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", end);
      window.removeEventListener("touchmove", onTouch);
      window.removeEventListener("touchend", end);
    };
  }, [draggingFocal, setFocalFromClient]);

  const exportFrame = useCallback(
    (format: ExportFormat) => {
      const display = displayRef.current;
      const sample = sampleRef.current;
      if (!display?.width || !sample) return;

      if (format === "svg") {
        const sCtx = sample.getContext("2d", { willReadFrequently: true });
        if (!sCtx) return;
        const data = sCtx.getImageData(0, 0, sample.width, sample.height).data;
        const vector = buildSvg(data, {
          effectId,
          params,
          algorithmMode,
          shapeId,
          bgColor,
          w: sample.width,
          h: sample.height,
        });
        downloadSvg(vector ?? rasterFallbackSvg(display));
        return;
      }

      const mime = format === "jpg" ? "image/jpeg" : "image/png";
      const url = display.toDataURL(mime, format === "jpg" ? 0.92 : undefined);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pattern-export.${format}`;
      a.click();
    },
    [effectId, params, algorithmMode, shapeId, bgColor]
  );

  useImperativeHandle(ref, () => ({ exportFrame }), [exportFrame]);

  useEffect(() => {
    onExportReady?.(exportFrame);
  }, [exportFrame, onExportReady]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => {
      const { w, h } = intrinsicRef.current;
      if (w > 0 && h > 0) applyCanvasSizes(w, h);
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [applyCanvasSizes]);

  useEffect(() => {
    if (!imageUrl) {
      imgRef.current = null;
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      applyCanvasSizes(img.naturalWidth, img.naturalHeight);
      drawFrameRef.current();
    };
    img.src = imageUrl;
  }, [imageUrl, applyCanvasSizes]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || (sourceMode !== "video" && sourceMode !== "webcam")) return;

    const onMeta = () => {
      if (video.videoWidth) applyCanvasSizes(video.videoWidth, video.videoHeight);
      drawFrameRef.current();
    };
    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("loadeddata", onMeta);
    video.addEventListener("canplay", onMeta);
    if (video.videoWidth) onMeta();
    return () => {
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("loadeddata", onMeta);
      video.removeEventListener("canplay", onMeta);
    };
  }, [sourceMode, videoRef, stream, applyCanvasSizes]);

  useEffect(() => {
    const video = videoRef.current;
    if (video) video.playbackRate = videoSpeed;
  }, [videoSpeed, videoRef]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || sourceMode === "image" || sourceMode === "none") return;
    if (videoPlaying) void video.play().catch(() => {});
    else video.pause();
  }, [videoPlaying, videoRef, sourceMode]);

  useEffect(() => {
    const loop = (now: number) => {
      if (effectPlaying) {
        const last = lastTickRef.current ?? now;
        const dt = Math.min(64, now - last);
        lastTickRef.current = now;
        animTimeRef.current += dt * effectSpeed;
      } else {
        lastTickRef.current = null;
      }

      if (sourceMode !== "none") drawFrame(now);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [drawFrame, sourceMode, effectPlaying, effectSpeed]);

  const display = displayRef.current;
  const focalOverlay =
    display?.width && display.height
      ? {
          left: `${((mediaRectRef.current.x + focalPoint.x * mediaRectRef.current.w) / display.width) * 100}%`,
          top: `${((mediaRectRef.current.y + focalPoint.y * mediaRectRef.current.h) / display.height) * 100}%`,
        }
      : { left: "50%", top: "50%" };

  return (
    <div
      ref={containerRef}
      className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black p-4"
    >
      <div
        ref={wrapRef}
        className="relative flex max-h-full max-w-full items-center justify-center"
      >
        <canvas
          ref={displayRef}
          className="block max-h-[calc(100vh-2rem)] max-w-full rounded-lg shadow-2xl"
        />
        {useFocalPoint &&
          effectId !== "track" &&
          effectId !== "glass" &&
          effectId !== "glitch" && (
          <div
            className="pointer-events-none absolute inset-0 rounded-lg"
            aria-hidden
          >
            <button
              type="button"
              aria-label="Drag focal point"
              className={`pointer-events-auto absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-cyan-400/90 bg-cyan-400/25 shadow-[0_0_12px_rgba(34,211,238,0.5)] ${
                draggingFocal ? "cursor-grabbing scale-110" : "cursor-grab"
              }`}
              style={focalOverlay}
              onMouseDown={(e) => {
                e.preventDefault();
                setDraggingFocal(true);
                setFocalFromClient(e.clientX, e.clientY);
              }}
              onTouchStart={(e) => {
                e.preventDefault();
                setDraggingFocal(true);
                const t = e.touches[0];
                if (t) setFocalFromClient(t.clientX, t.clientY);
              }}
            />
            <div
              className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-400/50"
              style={focalOverlay}
            />
          </div>
        )}
      </div>
      <canvas ref={sampleRef} className="hidden" aria-hidden />
      {(sourceMode === "video" || sourceMode === "webcam") && !videoPlaying && (
        <button
          type="button"
          onClick={() => {
            const v = videoRef.current;
            if (v) void v.play();
          }}
          className="absolute bottom-12 flex h-14 w-14 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur"
        >
          ▶
        </button>
      )}
    </div>
  );
});
