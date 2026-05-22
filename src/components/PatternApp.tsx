"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePatternStore } from "@/hooks/usePatternStore";
import { Sidebar } from "./Sidebar";
import { CanvasPreview, type CanvasPreviewHandle } from "./CanvasPreview";
import type { ExportFormat } from "@/lib/types";

export function PatternApp() {
  const store = usePatternStore();
  const { webcamOn, setWebcamOn, setSourceMode, setVideoPlaying, sourceMode, exportFormat } = store;
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<CanvasPreviewHandle>(null);
  const exportFnRef = useRef<((format: ExportFormat) => void) | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [hasMedia, setHasMedia] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const mediaUrlRef = useRef<string | null>(null);

  useEffect(() => {
    streamRef.current = stream;
  }, [stream]);

  const revokeMediaUrl = useCallback(() => {
    if (mediaUrlRef.current) {
      URL.revokeObjectURL(mediaUrlRef.current);
      mediaUrlRef.current = null;
    }
  }, []);

  const stopWebcam = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setStream(null);
    streamRef.current = null;
    const v = videoRef.current;
    if (v) {
      v.srcObject = null;
      v.removeAttribute("src");
      v.pause();
      v.load();
    }
    setWebcamOn(false);
    if (sourceMode === "webcam") {
      setSourceMode("none");
      setVideoPlaying(false);
    }
    setCameraError(null);
  }, [setWebcamOn, setSourceMode, setVideoPlaying, sourceMode]);

  useEffect(() => {
    if (!webcamOn) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      setStream(null);
      streamRef.current = null;
      const v = videoRef.current;
      if (v) {
        v.srcObject = null;
        v.removeAttribute("src");
        v.pause();
        v.load();
      }
      if (sourceMode === "webcam") {
        setSourceMode("none");
        setVideoPlaying(false);
      }
      return;
    }

    let cancelled = false;
    setCameraError(null);
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } } })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        setStream(s);
        setSourceMode("webcam");
        setVideoPlaying(true);
      })
      .catch(() => {
        setWebcamOn(false);
        setCameraError("Camera unavailable — check permissions");
      });

    return () => {
      cancelled = true;
    };
  }, [webcamOn, sourceMode, setSourceMode, setVideoPlaying, setWebcamOn]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !stream) return;
    v.srcObject = stream;
    v.muted = true;
    v.playsInline = true;
    setVideoPlaying(true);
    const play = () => {
      void v.play().catch(() => {});
    };
    v.addEventListener("loadedmetadata", play);
    v.addEventListener("loadeddata", play);
    v.addEventListener("canplay", play);
    if (v.readyState >= 2) play();
    else void v.play().catch(() => {});
    return () => {
      v.removeEventListener("loadedmetadata", play);
      v.removeEventListener("loadeddata", play);
      v.removeEventListener("canplay", play);
    };
  }, [stream, setVideoPlaying]);

  const onUpload = useCallback(
    (file: File) => {
      stopWebcam();
      revokeMediaUrl();
      const url = URL.createObjectURL(file);
      mediaUrlRef.current = url;
      if (file.type.startsWith("video/")) {
        setImageUrl(null);
        setSourceMode("video");
        const v = videoRef.current;
        if (v) {
          v.srcObject = null;
          v.src = url;
          v.loop = true;
          v.muted = true;
          v.load();
          setVideoPlaying(true);
          void v.play().catch(() => {});
        }
      } else {
        if (videoRef.current) {
          videoRef.current.srcObject = null;
          videoRef.current.removeAttribute("src");
          videoRef.current.pause();
          videoRef.current.load();
        }
        setImageUrl(url);
        setSourceMode("image");
      }
    },
    [setSourceMode, setVideoPlaying, stopWebcam, revokeMediaUrl]
  );

  useEffect(() => () => revokeMediaUrl(), [revokeMediaUrl]);

  const onExport = useCallback(() => {
    const fn = exportFnRef.current ?? canvasRef.current?.exportFrame;
    fn?.(exportFormat);
  }, [exportFormat]);

  const isVideoSource = sourceMode === "video" || sourceMode === "webcam";

  const canvasProps = useMemo(
    () => ({
      effectId: store.effectId,
      params: store.params,
      algorithmMode: store.algorithmMode,
      shapeId: store.shapeId,
      customPath: store.customPath,
      bgColor: store.bgColor,
      sourceMode: store.sourceMode,
      focalPoint: store.focalPoint,
      setFocalPoint: store.setFocalPoint,
      useFocalPoint: store.useFocalPoint,
      videoPlaying: store.videoPlaying,
      videoSpeed: store.videoSpeed,
      setTrackMlStatus: store.setTrackMlStatus,
      hasMedia,
    }),
    [
      store.effectId,
      store.params,
      store.algorithmMode,
      store.shapeId,
      store.customPath,
      store.bgColor,
      store.sourceMode,
      store.focalPoint,
      store.setFocalPoint,
      store.useFocalPoint,
      store.videoPlaying,
      store.videoSpeed,
      store.setTrackMlStatus,
      hasMedia,
    ]
  );

  const sidebarProps = useMemo(
    () => ({
      ...store,
      onUpload,
      onExport,
      hasMedia,
      isVideoSource,
      cameraError,
      trackMlStatus: store.trackMlStatus,
    }),
    [store, onUpload, onExport, hasMedia, isVideoSource, cameraError]
  );

  const onExportReady = useCallback((fn: (format: ExportFormat) => void) => {
    exportFnRef.current = fn;
  }, []);

  return (
    <div className="flex h-screen gap-4 overflow-hidden bg-workspace p-4">
      <Sidebar {...sidebarProps} />
      <main className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-workspace">
        <video ref={videoRef} className="hidden" playsInline muted autoPlay />
        <CanvasPreview
          ref={canvasRef}
          {...canvasProps}
          imageUrl={imageUrl}
          videoRef={videoRef}
          stream={stream}
          onReadyChange={setHasMedia}
          onExportReady={onExportReady}
        />
      </main>
    </div>
  );
}
