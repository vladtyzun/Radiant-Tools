"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

  useEffect(() => {
    streamRef.current = stream;
  }, [stream]);

  const stopWebcam = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setStream(null);
    streamRef.current = null;
    const v = videoRef.current;
    if (v) {
      v.srcObject = null;
      v.pause();
    }
    setWebcamOn(false);
    if (sourceMode === "webcam") setSourceMode("none");
    setCameraError(null);
  }, [setWebcamOn, setSourceMode, sourceMode]);

  useEffect(() => {
    if (!webcamOn) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        setStream(null);
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
  }, [webcamOn, setSourceMode, setVideoPlaying, setWebcamOn]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !stream) return;
    v.srcObject = stream;
    v.muted = true;
    v.playsInline = true;
    const play = () => {
      void v.play().catch(() => {});
    };
    v.addEventListener("loadeddata", play);
    v.addEventListener("canplay", play);
    if (v.readyState >= 2) play();
    return () => {
      v.removeEventListener("loadeddata", play);
      v.removeEventListener("canplay", play);
    };
  }, [stream]);

  const onUpload = useCallback(
    (file: File) => {
      stopWebcam();
      const url = URL.createObjectURL(file);
      if (file.type.startsWith("video/")) {
        setImageUrl(null);
        setSourceMode("video");
        const v = videoRef.current;
        if (v) {
          v.srcObject = null;
          v.src = url;
          v.loop = true;
          v.muted = true;
          setVideoPlaying(true);
          void v.play();
        }
      } else {
        if (videoRef.current) {
          videoRef.current.srcObject = null;
          videoRef.current.removeAttribute("src");
          videoRef.current.pause();
        }
        setImageUrl(url);
        setSourceMode("image");
      }
    },
    [setSourceMode, setVideoPlaying, stopWebcam]
  );

  const onExport = useCallback(() => {
    const fn = exportFnRef.current ?? canvasRef.current?.exportFrame;
    fn?.(exportFormat);
  }, [exportFormat]);

  const isVideoSource = sourceMode === "video" || sourceMode === "webcam";

  return (
    <div className="flex h-screen overflow-hidden bg-black">
      <Sidebar
        {...store}
        onUpload={onUpload}
        onExport={onExport}
        hasMedia={hasMedia}
        isVideoSource={isVideoSource}
        cameraError={cameraError}
        trackMlStatus={store.trackMlStatus}
      />
      <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <video ref={videoRef} className="hidden" playsInline muted autoPlay />
        <CanvasPreview
          ref={canvasRef}
          {...store}
          imageUrl={imageUrl}
          videoRef={videoRef}
          stream={stream}
          onReadyChange={setHasMedia}
          onExportReady={(fn) => {
            exportFnRef.current = fn;
          }}
        />
      </main>
    </div>
  );
}
