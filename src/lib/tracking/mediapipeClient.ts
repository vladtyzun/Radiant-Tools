"use client";

import {
  FaceLandmarker,
  FilesetResolver,
  HandLandmarker,
} from "@mediapipe/tasks-vision";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

const WASM_CDN =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const HAND_MODEL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const FACE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

export type HandDetection = {
  landmarks: NormalizedLandmark[][];
  connections: { start: number; end: number }[];
};

export type EyeDetection = {
  landmarks: NormalizedLandmark[][];
  leftEyeIndices: number[];
  rightEyeIndices: number[];
};

let loadPromise: Promise<void> | null = null;
let handLandmarker: HandLandmarker | null = null;
let faceLandmarker: FaceLandmarker | null = null;
let videoMode = false;
let lastError: string | null = null;

export function getTrackMlError(): string | null {
  return lastError;
}

async function ensureLoaded(): Promise<void> {
  if (handLandmarker && faceLandmarker) return;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const vision = await FilesetResolver.forVisionTasks(WASM_CDN);
      const baseHand = { modelAssetPath: HAND_MODEL, delegate: "GPU" as const };
      const baseFace = { modelAssetPath: FACE_MODEL, delegate: "GPU" as const };
      try {
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: baseHand,
          runningMode: "IMAGE",
          numHands: 2,
        });
        faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: baseFace,
          runningMode: "IMAGE",
          numFaces: 1,
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: false,
        });
      } catch {
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: { ...baseHand, delegate: "CPU" },
          runningMode: "IMAGE",
          numHands: 2,
        });
        faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: { ...baseFace, delegate: "CPU" },
          runningMode: "IMAGE",
          numFaces: 1,
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: false,
        });
      }
      lastError = null;
    } catch (e) {
      lastError =
        e instanceof Error ? e.message : "Failed to load tracking models";
      handLandmarker = null;
      faceLandmarker = null;
      throw e;
    }
  })();
  return loadPromise;
}

export async function initTrackModels(isVideo: boolean): Promise<boolean> {
  try {
    await ensureLoaded();
    if (!handLandmarker || !faceLandmarker) return false;
    const mode = isVideo ? "VIDEO" : "IMAGE";
    if (videoMode !== isVideo) {
      handLandmarker.setOptions({ runningMode: mode });
      faceLandmarker.setOptions({ runningMode: mode });
      videoMode = isVideo;
    }
    return true;
  } catch {
    return false;
  }
}

export function detectHands(
  source: HTMLCanvasElement | HTMLVideoElement,
  timestampMs: number,
  isVideo: boolean
): HandDetection | null {
  if (!handLandmarker) return null;
  try {
    const result = isVideo
      ? handLandmarker.detectForVideo(source, timestampMs)
      : handLandmarker.detect(source);
    const landmarks = result.landmarks ?? [];
    const connections = HandLandmarker.HAND_CONNECTIONS.map((c) => ({
      start: c.start,
      end: c.end,
    }));
    return { landmarks, connections };
  } catch {
    return null;
  }
}

const LEFT_EYE_CENTER = [33, 133, 160, 159, 158, 157, 173];
const RIGHT_EYE_CENTER = [362, 263, 387, 386, 385, 384, 398];

export function detectEyes(
  source: HTMLCanvasElement | HTMLVideoElement,
  timestampMs: number,
  isVideo: boolean
): EyeDetection | null {
  if (!faceLandmarker) return null;
  try {
    const result = isVideo
      ? faceLandmarker.detectForVideo(source, timestampMs)
      : faceLandmarker.detect(source);
    const landmarks = result.faceLandmarks ?? [];
    return {
      landmarks,
      leftEyeIndices: LEFT_EYE_CENTER,
      rightEyeIndices: RIGHT_EYE_CENTER,
    };
  } catch {
    return null;
  }
}

export function disposeTrackModels() {
  handLandmarker?.close();
  faceLandmarker?.close();
  handLandmarker = null;
  faceLandmarker = null;
  loadPromise = null;
  videoMode = false;
}
