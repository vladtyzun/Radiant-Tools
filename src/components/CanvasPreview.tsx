"use client";

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  forwardRef,
  useState,
} from "react";
import { cloneImageData, renderEffect } from "@/lib/effects/render";
import { computeMotionRegions, renderTrackBase, readTrackParams } from "@/lib/effects/track";
import { buildSvg, downloadSvg, rasterFallbackSvg } from "@/lib/exportSvg";
import { drawEyeHighlights, drawHandSkeleton, drawMotionRegions } from "@/lib/tracking/draw";
import {
  fitContain,
  fitToMaxEdge,
  getLayoutViewport,
  clientToMediaNorm,
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
import type {
  AlgorithmMode,
  EffectId,
  ExportFormat,
  FocalPoint,
  Params,
  ShapeId,
  SourceMode,
} from "@/lib/types";

type Props = {
  effectId: EffectId;
  params: Params;
  algorithmMode: AlgorithmMode;
  shapeId: ShapeId;
  customPath: Path2D | null;
  bgColor: string;
  sourceMode: SourceMode;
  focalPoint: FocalPoint;
  setFocalPoint: (p: FocalPoint) => void;
  useFocalPoint: boolean;
  videoPlaying: boolean;
  videoSpeed: 1 | 2 | 3;
  setTrackMlStatus: (msg: string | null) => void;
  imageUrl: string | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  stream: MediaStream | null;
  hasMedia: boolean;
  onReadyChange: (ready: boolean) => void;
  onExportReady?: (fn: (format: ExportFormat) => void) => void;
};

const RENDER_MAX = 960;
const DISPLAY_MAX = 720;
const PARAM_DEBOUNCE_MS = 32;
const ML_INTERVAL_MS = 50;
const ZOOM_MIN = 0.1;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.1;
const DOT_GRID_SPACING = 20; // base spacing at viewZoom 1.0
const DOT_GRID_MIN_SPACING = 6; // floor at extreme zoom out
const DOT_GRID_COLOR = "#3a3a3a";
const WORKSPACE_PADDING = 64;
const WORKSPACE_MIN_W = 320;
const WORKSPACE_MIN_H = 240;

function clampZoom(z: number) {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 100) / 100));
}

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
    focalPoint,
    setFocalPoint,
    useFocalPoint,
    videoPlaying,
    videoSpeed,
    imageUrl,
    videoRef,
    stream,
    hasMedia,
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
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const intrinsicRef = useRef({ w: 0, h: 0 });
  const mediaRectRef = useRef<MediaRect>({ x: 0, y: 0, w: 1, h: 1 });
  const lastMlRef = useRef(0);
  const mlStaticKeyRef = useRef("");
  const mlReadyRef = useRef(false);
  const handsRef = useRef<ReturnType<typeof detectHands>>(null);
  const eyesRef = useRef<ReturnType<typeof detectEyes>>(null);
  const dirtyRef = useRef(true);
  const loopActiveRef = useRef(false);
  const loopGenRef = useRef(0);
  const sourceModeRef = useRef(sourceMode);
  sourceModeRef.current = sourceMode;
  const renderParamsRef = useRef(params);
  const renderCtxRef = useRef({
    effectId,
    algorithmMode,
    shapeId,
    customPath,
    bgColor,
    focalPoint,
    useFocalPoint,
  });
  renderCtxRef.current = {
    effectId,
    algorithmMode,
    shapeId,
    customPath,
    bgColor,
    focalPoint,
    useFocalPoint,
  };
  const dCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const sCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const [draggingFocal, setDraggingFocal] = useState(false);
  const [focalHover, setFocalHover] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const draggingFocalRef = useRef(false);
  const focalHandleRef = useRef<HTMLButtonElement>(null);
  const [viewZoom, setViewZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [displaySize, setDisplaySize] = useState({ w: 0, h: 0 });
  const [scrollViewport, setScrollViewport] = useState({ w: 0, h: 0 });
  const panningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const drawFrameRef = useRef<(now?: number) => void>(() => {});
  const scheduleFrameRef = useRef<() => void>(() => {});

  const bindContexts = useCallback(() => {
    const display = displayRef.current;
    const sample = sampleRef.current;
    if (!display || !sample) return;
    if (!dCtxRef.current) {
      dCtxRef.current = display.getContext("2d", { willReadFrequently: false });
    }
    if (!sCtxRef.current) {
      sCtxRef.current = sample.getContext("2d", { willReadFrequently: true });
    }
  }, []);

  useEffect(() => {
    renderParamsRef.current = params;
    dirtyRef.current = true;
    scheduleFrameRef.current();
    const id = window.setTimeout(() => {
      renderParamsRef.current = params;
      dirtyRef.current = true;
      scheduleFrameRef.current();
    }, PARAM_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [params]);

  useEffect(() => {
    renderParamsRef.current = params;
    dirtyRef.current = true;
    scheduleFrameRef.current();
  }, [
    effectId,
    algorithmMode,
    shapeId,
    customPath,
    bgColor,
    focalPoint,
    useFocalPoint,
    sourceMode,
    videoPlaying,
    videoSpeed,
  ]);

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
      dCtxRef.current = null;
    }
    if (sampleRef.current) {
      sampleRef.current.width = render.w;
      sampleRef.current.height = render.h;
      sCtxRef.current = null;
    }
    dirtyRef.current = true;
    bindContexts();
    scheduleFrameRef.current();
  }, [bindContexts]);

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
      dCtx.fillStyle = renderCtxRef.current.bgColor;
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
    []
  );

  const setFocalFromClient = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = displayRef.current;
      if (!canvas?.width) return;
      const media = mediaRectRef.current;
      const { x, y } = clientToMediaNorm(clientX, clientY, canvas, media);
      setFocalPoint({ x, y });
    },
    [setFocalPoint]
  );

  const endFocalDrag = useCallback(() => {
    draggingFocalRef.current = false;
    setDraggingFocal(false);
  }, []);

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
      const tp = readTrackParams(renderParamsRef.current);
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
        const mlKey = `${tp.trackHands}:${tp.trackEyes}:${isVideo}`;
        const runMl =
          isVideo
            ? now - lastMlRef.current >= ML_INTERVAL_MS
            : mlStaticKeyRef.current !== mlKey;
        if (runMl) {
          lastMlRef.current = now;
          mlStaticKeyRef.current = mlKey;
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
    [sourceMode, blitSampleToDisplay]
  );

  const needsContinuousFrame = useCallback(() => {
    const mode = sourceModeRef.current;
    if (mode === "none") return false;
    const isVideo = mode === "video" || mode === "webcam";
    // Live camera must redraw every frame (track motion, imgTrack edges, ML).
    if (mode === "webcam") return true;
    if (isVideo && videoPlaying) return true;
    const ctx = renderCtxRef.current;
    if (ctx.effectId === "track" || ctx.effectId === "imgTrack") {
      const tp = readTrackParams(renderParamsRef.current);
      if (tp.trackMotion && isVideo && videoPlaying) return true;
      if (ctx.effectId === "imgTrack" && isVideo && videoPlaying) return true;
    }
    return false;
  }, [videoPlaying]);

  const drawFrame = useCallback(
    (now = performance.now()) => {
      const display = displayRef.current;
      const sample = sampleRef.current;
      if (!display || !sample) return;
      bindContexts();
      const dCtx = dCtxRef.current;
      const sCtx = sCtxRef.current;
      if (!dCtx || !sCtx) return;

      const video = videoRef.current;
      let hasSource = false;
      const renderW = sample.width;
      const renderH = sample.height;
      const displayW = display.width;
      const displayH = display.height;
      const mirrorSample = sourceMode === "webcam";
      const mirrorX = false;

      if (sourceMode === "image" && imgRef.current?.complete) {
        sCtx.setTransform(1, 0, 0, 1, 0, 0);
        sCtx.drawImage(imgRef.current, 0, 0, renderW, renderH);
        hasSource = true;
      } else if ((sourceMode === "video" || sourceMode === "webcam") && video && video.readyState >= 2) {
        sCtx.setTransform(1, 0, 0, 1, 0, 0);
        if (mirrorSample) {
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

      if (displayW !== displaySize.w || displayH !== displaySize.h) {
        setDisplaySize({ w: displayW, h: displayH });
      }

      onReadyChange(true);

      const ctx = renderCtxRef.current;
      if (ctx.effectId === "track") {
        drawTrackFrame(dCtx, sCtx, renderW, renderH, displayW, displayH, mirrorX, now);
        return;
      }

      const rp = renderParamsRef.current;
      renderEffect(sCtx, sCtx, renderW, renderH, {
        effectId: ctx.effectId,
        params: rp,
        algorithmMode: ctx.algorithmMode,
        shapeId: ctx.shapeId,
        customPath: ctx.customPath,
        bgColor: ctx.bgColor,
        prevFrame: prevFrameRef.current,
        focalPoint: ctx.focalPoint,
        useFocalPoint: ctx.useFocalPoint,
      });
      prevFrameRef.current = cloneImageData(
        sCtx.getImageData(0, 0, renderW, renderH).data
      );
      blitSampleToDisplay(dCtx, sCtx.canvas, renderW, renderH, displayW, displayH);
    },
    [
      sourceMode,
      videoRef,
      onReadyChange,
      drawTrackFrame,
      blitSampleToDisplay,
      bindContexts,
    ]
  );

  useLayoutEffect(() => {
    drawFrameRef.current = drawFrame;
  }, [drawFrame]);

  useEffect(() => {
    if (effectId !== "track") {
      mlReadyRef.current = false;
      mlStaticKeyRef.current = "";
      handsRef.current = null;
      eyesRef.current = null;
      setTrackMlStatus(null);
      disposeTrackModels();
      return;
    }
    const isVideo = sourceMode === "video" || sourceMode === "webcam";
    let cancelled = false;
    void initTrackModels(isVideo).then((ok) => {
      if (cancelled) return;
      mlReadyRef.current = ok;
      mlStaticKeyRef.current = "";
      if (!ok) {
        setTrackMlStatus(
          getTrackMlError() ?? "Hand/eye models unavailable — motion tracking still works"
        );
      } else {
        setTrackMlStatus(null);
      }
      dirtyRef.current = true;
      scheduleFrameRef.current();
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
    const onMove = (e: PointerEvent) => {
      if (!draggingFocalRef.current) return;
      setFocalFromClient(e.clientX, e.clientY);
    };
    const end = () => endFocalDrag();
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, [draggingFocal, setFocalFromClient, endFocalDrag]);

  const exportFrame = useCallback(
    (format: ExportFormat) => {
      const sample = sampleRef.current;
      if (!sample?.width) return;

      drawFrameRef.current();

      if (format === "svg") {
        const sCtx = sample.getContext("2d", { willReadFrequently: true });
        if (!sCtx) return;
        const data = sCtx.getImageData(0, 0, sample.width, sample.height).data;
        const ctx = renderCtxRef.current;
        const vector = buildSvg(data, {
          effectId: ctx.effectId,
          params: renderParamsRef.current,
          algorithmMode: ctx.algorithmMode,
          shapeId: ctx.shapeId,
          bgColor: ctx.bgColor,
          w: sample.width,
          h: sample.height,
        });
        const fallback = document.createElement("canvas");
        fallback.width = sample.width;
        fallback.height = sample.height;
        fallback.getContext("2d")!.drawImage(sample, 0, 0);
        downloadSvg(vector ?? rasterFallbackSvg(fallback));
        return;
      }

      const mime = format === "jpg" ? "image/jpeg" : "image/png";
      const url = sample.toDataURL(mime, format === "jpg" ? 0.92 : undefined);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pattern-export.${format}`;
      a.click();
    },
    []
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
    if (!imageUrl || sourceMode !== "image") {
      imgRef.current = null;
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      imgRef.current = img;
      applyCanvasSizes(img.naturalWidth, img.naturalHeight);
      dirtyRef.current = true;
      drawFrameRef.current();
    };
    img.src = imageUrl;
    return () => {
      cancelled = true;
      img.onload = null;
    };
  }, [imageUrl, sourceMode, applyCanvasSizes]);

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
    // Keep live webcam frames flowing even when playback UI is paused.
    if (sourceMode === "webcam") {
      void video.play().catch(() => {});
      return;
    }
    if (videoPlaying) void video.play().catch(() => {});
    else video.pause();
  }, [videoPlaying, videoRef, sourceMode]);

  const resetSourceState = useCallback(() => {
    prevFrameRef.current = null;
    mlStaticKeyRef.current = "";
    handsRef.current = null;
    eyesRef.current = null;
    lastMlRef.current = 0;
    dirtyRef.current = true;
    scheduleFrameRef.current();
  }, []);

  useEffect(() => {
    resetSourceState();
    if (sourceMode === "none") {
      intrinsicRef.current = { w: 0, h: 0 };
      onReadyChange(false);
    }
  }, [sourceMode, stream, imageUrl, effectId, resetSourceState, onReadyChange]);

  useEffect(() => {
    if (effectId !== "track" && mlReadyRef.current) {
      mlReadyRef.current = false;
      disposeTrackModels();
    }
  }, [effectId]);

  const kickLoop = useCallback(() => {
    if (loopActiveRef.current) return;
    loopActiveRef.current = true;
    const gen = ++loopGenRef.current;
    const loop = (now: number) => {
      if (gen !== loopGenRef.current) return;

      const continuous = needsContinuousFrame();

      if (sourceModeRef.current !== "none" && (continuous || dirtyRef.current)) {
        drawFrameRef.current(now);
        dirtyRef.current = false;
      }

      if (gen !== loopGenRef.current) return;

      if (continuous || dirtyRef.current) {
        rafRef.current = requestAnimationFrame(loop);
      } else {
        loopActiveRef.current = false;
      }
    };
    rafRef.current = requestAnimationFrame(loop);
  }, [needsContinuousFrame]);

  useEffect(() => {
    scheduleFrameRef.current = () => {
      dirtyRef.current = true;
      kickLoop();
    };
  }, [kickLoop]);

  useEffect(() => {
    dirtyRef.current = true;
    kickLoop();
    return () => {
      loopGenRef.current += 1;
      cancelAnimationFrame(rafRef.current);
      loopActiveRef.current = false;
    };
  }, [kickLoop, needsContinuousFrame]);

  const focalMedia = mediaRectRef.current;
  const focalOverlay =
    displaySize.w > 0 && displaySize.h > 0
      ? {
          left: `${((focalMedia.x + focalPoint.x * focalMedia.w) / displaySize.w) * 100}%`,
          top: `${((focalMedia.y + focalPoint.y * focalMedia.h) / displaySize.h) * 100}%`,
        }
      : { left: "50%", top: "50%" };

  const vpW = scrollViewport.w || WORKSPACE_MIN_W;
  const vpH = scrollViewport.h || WORKSPACE_MIN_H;
  const mediaW = displaySize.w * viewZoom + WORKSPACE_PADDING;
  const mediaH = displaySize.h * viewZoom + WORKSPACE_PADDING;
  const workspaceW = hasMedia
    ? Math.max(vpW, mediaW, displaySize.w + WORKSPACE_PADDING, WORKSPACE_MIN_W)
    : Math.max(vpW / viewZoom, vpW, WORKSPACE_MIN_W);
  const workspaceH = hasMedia
    ? Math.max(vpH, mediaH, displaySize.h + WORKSPACE_PADDING, WORKSPACE_MIN_H)
    : Math.max(vpH / viewZoom, vpH, WORKSPACE_MIN_H);
  const gridStep = Math.max(DOT_GRID_MIN_SPACING, DOT_GRID_SPACING * viewZoom);
  const dotRadius = gridStep / DOT_GRID_SPACING;
  const panZoomStyle = {
    transform: `translate(${pan.x}px, ${pan.y}px) scale(${viewZoom})`,
    transformOrigin: "center center",
  } as const;
  const scrollGridStyle = {
    backgroundSize: `${gridStep}px ${gridStep}px`,
    backgroundImage: `radial-gradient(circle, ${DOT_GRID_COLOR} ${dotRadius}px, transparent ${dotRadius}px)`,
    backgroundRepeat: "repeat",
    backgroundAttachment: "local",
  } as const;
  const zoomPct = Math.round(viewZoom * 100);
  const atZoomMin = viewZoom <= ZOOM_MIN;
  const atZoomMax = viewZoom >= ZOOM_MAX;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const updateViewport = () => {
      setScrollViewport({ w: el.clientWidth, h: el.clientHeight });
    };
    const ro = new ResizeObserver(updateViewport);
    ro.observe(el);
    updateViewport();
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.ctrlKey || e.metaKey) {
        const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
        setViewZoom((z) => {
          const next = clampZoom(z + delta);
          if (next === z) return z;
          return next;
        });
      } else {
        setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const onPanPointerDown = (e: React.PointerEvent) => {
    if (draggingFocalRef.current) return;
    if (e.button !== 0 && e.button !== 1) return;
    panningRef.current = true;
    setIsPanning(true);
    panStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPanPointerMove = (e: React.PointerEvent) => {
    if (!panningRef.current) return;
    const s = panStartRef.current;
    setPan({
      x: s.panX + (e.clientX - s.x),
      y: s.panY + (e.clientY - s.y),
    });
  };

  const onPanPointerUp = (e: React.PointerEvent) => {
    panningRef.current = false;
    setIsPanning(false);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  };

  const onFocalPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    draggingFocalRef.current = true;
    setDraggingFocal(true);
    setFocalFromClient(e.clientX, e.clientY);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onFocalPointerUp = (e: React.PointerEvent) => {
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    endFocalDrag();
  };

  return (
    <div
      ref={containerRef}
      className="canvas-workspace relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
    >
      <div
        ref={scrollRef}
        className="canvas-dot-grid relative min-h-0 min-w-0 flex-1 overflow-auto"
        onPointerDown={onPanPointerDown}
        onPointerMove={onPanPointerMove}
        onPointerUp={onPanPointerUp}
        onPointerCancel={onPanPointerUp}
        style={{
          ...scrollGridStyle,
          cursor: isPanning ? "grabbing" : "default",
        }}
      >
        {!hasMedia && (
          <p className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center text-sm text-[#666]">
            Upload media
          </p>
        )}
        <div
          className="relative min-h-full min-w-full p-8"
          style={{ minWidth: workspaceW, minHeight: workspaceH }}
        >
          <div
            ref={wrapRef}
            className="relative flex min-h-full min-w-full items-center justify-center"
            style={panZoomStyle}
          >
            <div className="relative shrink-0">
              <canvas
                ref={displayRef}
                className={
                  hasMedia ? "block shadow-2xl" : "pointer-events-none invisible absolute h-0 w-0"
                }
                aria-hidden={!hasMedia}
              />
              {hasMedia &&
                useFocalPoint &&
                effectId !== "track" &&
                effectId !== "glass" &&
                effectId !== "fractalGlass" &&
                effectId !== "glitch" && (
                <div className="pointer-events-none absolute inset-0" aria-hidden>
                  <button
                    ref={focalHandleRef}
                    type="button"
                    aria-label="Drag focal point"
                    className={`pointer-events-auto absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-cyan-400/25 transition-shadow ${
                      draggingFocal
                        ? "scale-110 border-cyan-300 bg-cyan-400/35 shadow-[0_0_16px_rgba(34,211,238,0.75)] outline outline-2 outline-offset-1 outline-cyan-300"
                        : focalHover
                          ? "border-cyan-300 bg-cyan-400/35 shadow-[0_0_18px_rgba(34,211,238,0.7)]"
                          : "border-cyan-400/90 shadow-[0_0_12px_rgba(34,211,238,0.5)]"
                    } cursor-pointer`}
                    style={focalOverlay}
                    onPointerDown={onFocalPointerDown}
                    onPointerUp={onFocalPointerUp}
                    onPointerCancel={onFocalPointerUp}
                    onPointerEnter={() => setFocalHover(true)}
                    onPointerLeave={() => setFocalHover(false)}
                  />
                  <div
                    className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-400/50"
                    style={focalOverlay}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div
        className="pointer-events-auto absolute bottom-4 right-4 z-10 flex items-center gap-1 rounded-lg border border-[#333] bg-[#292929]/95 px-1 py-1 text-xs text-white shadow-lg backdrop-blur"
        title="Scroll to pan · Ctrl/Cmd + scroll to zoom · Export uses effect resolution (ignores zoom)"
      >
        <button
          type="button"
          aria-label="Zoom out"
          disabled={atZoomMin}
          className="flex h-7 w-7 items-center justify-center rounded hover:bg-[#3a3a3a] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
          onClick={() => setViewZoom((z) => clampZoom(z - ZOOM_STEP))}
        >
          −
        </button>
        <span className="min-w-[3rem] text-center tabular-nums">{zoomPct}%</span>
        <button
          type="button"
          aria-label="Zoom in"
          disabled={atZoomMax}
          className="flex h-7 w-7 items-center justify-center rounded hover:bg-[#3a3a3a] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
          onClick={() => setViewZoom((z) => clampZoom(z + ZOOM_STEP))}
        >
          +
        </button>
        <button
          type="button"
          aria-label="Reset zoom and pan"
          className="ml-1 rounded px-2 py-1 text-[10px] text-muted hover:bg-[#3a3a3a] hover:text-white"
          onClick={() => {
            setViewZoom(1);
            setPan({ x: 0, y: 0 });
          }}
        >
          Reset
        </button>
      </div>

      <canvas ref={sampleRef} className="hidden" aria-hidden />
      {sourceMode === "video" && !videoPlaying && (
        <button
          type="button"
          onClick={() => {
            const v = videoRef.current;
            if (v) void v.play();
          }}
          className="absolute bottom-16 left-1/2 z-10 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur"
        >
          ▶
        </button>
      )}
    </div>
  );
});
