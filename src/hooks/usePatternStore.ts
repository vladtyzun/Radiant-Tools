"use client";

import { useCallback, useMemo, useState } from "react";
import { allDefaultParams } from "@/lib/paramDefs";
import type {
  AlgorithmMode,
  BackgroundPreset,
  EffectId,
  FocalPoint,
  Params,
  ShapeId,
  SourceMode,
} from "@/lib/types";
import { BACKGROUND_COLORS } from "@/lib/types";

export function usePatternStore() {
  const [effectId, setEffectId] = useState<EffectId>("pattern");
  const [paramsByEffect, setParamsByEffect] = useState(allDefaultParams);
  const [algorithmMode, setAlgorithmMode] = useState<AlgorithmMode>("halftone");
  const [shapeId, setShapeId] = useState<ShapeId>("circle");
  const [customPath, setCustomPath] = useState<Path2D | null>(null);
  const [bgPreset, setBgPreset] = useState<BackgroundPreset>("dark");
  const [customBg, setCustomBg] = useState("#0a0a0a");
  const [sourceMode, setSourceMode] = useState<SourceMode>("none");
  const [effectPlaying, setEffectPlaying] = useState(false);
  const [effectSpeed, setEffectSpeed] = useState<1 | 2 | 3>(1);
  const [videoPlaying, setVideoPlaying] = useState(true);
  const [videoSpeed, setVideoSpeed] = useState<1 | 2 | 3>(1);
  const [exportFormat, setExportFormat] = useState<"png" | "jpg" | "svg">("png");
  const [webcamOn, setWebcamOn] = useState(false);
  const [focalPoint, setFocalPoint] = useState<FocalPoint>({ x: 0.5, y: 0.5 });
  const [useFocalPoint, setUseFocalPoint] = useState(true);
  const [trackMlStatus, setTrackMlStatus] = useState<string | null>(null);

  const resetFocalPoint = useCallback(() => setFocalPoint({ x: 0.5, y: 0.5 }), []);

  const params = paramsByEffect[effectId];

  const setParam = useCallback(
    (key: string, value: number | boolean | string) => {
      setParamsByEffect((prev) => ({
        ...prev,
        [effectId]: { ...prev[effectId], [key]: value },
      }));
    },
    [effectId]
  );

  const bgColor =
    bgPreset === "custom" ? customBg : BACKGROUND_COLORS[bgPreset];

  return useMemo(
    () => ({
      effectId,
      setEffectId,
      params,
      setParam,
      paramsByEffect,
      algorithmMode,
      setAlgorithmMode,
      shapeId,
      setShapeId,
      customPath,
      setCustomPath,
      bgPreset,
      setBgPreset,
      customBg,
      setCustomBg,
      bgColor,
      sourceMode,
      setSourceMode,
      effectPlaying,
      setEffectPlaying,
      effectSpeed,
      setEffectSpeed,
      videoPlaying,
      setVideoPlaying,
      videoSpeed,
      setVideoSpeed,
      exportFormat,
      setExportFormat,
      webcamOn,
      setWebcamOn,
      focalPoint,
      setFocalPoint,
      useFocalPoint,
      setUseFocalPoint,
      resetFocalPoint,
      trackMlStatus,
      setTrackMlStatus,
    }),
    [
      effectId,
      params,
      paramsByEffect,
      algorithmMode,
      shapeId,
      customPath,
      bgPreset,
      customBg,
      bgColor,
      sourceMode,
      effectPlaying,
      effectSpeed,
      videoPlaying,
      videoSpeed,
      exportFormat,
      webcamOn,
      focalPoint,
      useFocalPoint,
      trackMlStatus,
      setEffectId,
      setParam,
      setAlgorithmMode,
      setShapeId,
      setCustomPath,
      setBgPreset,
      setCustomBg,
      setSourceMode,
      setEffectPlaying,
      setEffectSpeed,
      setVideoPlaying,
      setVideoSpeed,
      setExportFormat,
      setWebcamOn,
      setFocalPoint,
      setUseFocalPoint,
      resetFocalPoint,
      setTrackMlStatus,
    ]
  );
}

export type PatternStore = ReturnType<typeof usePatternStore>;
