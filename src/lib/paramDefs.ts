import type { EffectId, ParamControl, Params } from "./types";

export const EFFECT_ORDER: EffectId[] = [
  "blur",
  "cHtone",
  "glass",
  "ascii",
  "track",
  "halftone",
  "dither",
  "glitch",
  "vintage",
  "imgTrack",
  "dotChar",
  "pattern",
  "pixel",
  "stage",
];

const defs: Record<EffectId, ParamControl[]> = {
  pattern: [
    { key: "cellSize", label: "Cell Size", type: "slider", min: 4, max: 48, default: 16 },
    { key: "gap", label: "Gap", type: "slider", min: 0, max: 20, default: 2 },
    { key: "contrast", label: "Contrast", type: "slider", min: 0, max: 100, default: 50 },
    { key: "opacity", label: "Opacity", type: "slider", min: 0, max: 100, default: 100 },
    { key: "threshold", label: "Threshold", type: "slider", min: 0, max: 255, default: 0 },
    { key: "shapeScale", label: "Shape Scale", type: "slider", min: 10, max: 100, default: 80 },
    { key: "invert", label: "Invert", type: "toggle", default: false },
  ],
  halftone: [
    { key: "cellSize", label: "Cell Size", type: "slider", min: 4, max: 40, default: 12 },
    { key: "gap", label: "Gap", type: "slider", min: 0, max: 16, default: 1 },
    { key: "contrast", label: "Contrast", type: "slider", min: 0, max: 100, default: 50 },
    { key: "opacity", label: "Opacity", type: "slider", min: 0, max: 100, default: 100 },
    { key: "minDot", label: "Min Dot", type: "slider", min: 0, max: 50, default: 5 },
    { key: "maxDot", label: "Max Dot", type: "slider", min: 50, max: 100, default: 95 },
    { key: "threshold", label: "Threshold", type: "slider", min: 0, max: 255, default: 0 },
  ],
  track: [
    { key: "trackHands", label: "Hands", type: "toggle", default: true },
    { key: "trackEyes", label: "Eyes", type: "toggle", default: true },
    { key: "handSkeleton", label: "Hand Skeleton", type: "toggle", default: true },
    { key: "trackMotion", label: "Motion Regions", type: "toggle", default: true },
    {
      key: "boxStyle",
      label: "Box Style",
      type: "select",
      options: [
        { value: "frame", label: "Frame" },
        { value: "solid", label: "Solid" },
        { value: "dash", label: "Dash" },
        { value: "dot", label: "Dot" },
      ],
      default: "frame",
    },
    { key: "sensitivity", label: "Sensitivity", type: "slider", min: 1, max: 100, default: 60 },
    { key: "maxRegions", label: "Max Regions", type: "slider", min: 1, max: 20, default: 5 },
    { key: "skeletonLineWidth", label: "Skeleton Line Width", type: "slider", min: 1, max: 8, default: 2 },
    { key: "eyeHighlightSize", label: "Eye Highlight Size", type: "slider", min: 20, max: 100, default: 50 },
    {
      key: "boxColor",
      label: "Box Color",
      type: "colorGrid",
      colors: [
        "#f5d547",
        "#c0c0c0",
        "#e74c3c",
        "#9b59b6",
        "#00d4ff",
        "#3498db",
        "#ff69b4",
        "#2ecc71",
        "#ffffff",
      ],
      default: "#ffffff",
    },
    {
      key: "eyeColor",
      label: "Eye Color",
      type: "colorGrid",
      colors: ["#22d3ee", "#00d4ff", "#3498db", "#9b59b6", "#2ecc71", "#f5d547", "#ff69b4", "#ffffff", "#e74c3c"],
      default: "#22d3ee",
    },
    { key: "invert", label: "Invert (dark on light)", type: "toggle", default: false },
    { key: "cellSize", label: "Block Size", type: "slider", min: 8, max: 64, default: 24 },
  ],
  dotChar: [
    { key: "cellSize", label: "Cell Size", type: "slider", min: 6, max: 32, default: 14 },
    { key: "gap", label: "Gap", type: "slider", min: 0, max: 12, default: 2 },
    { key: "contrast", label: "Contrast", type: "slider", min: 0, max: 100, default: 47 },
    { key: "baseScale", label: "Base Scale", type: "slider", min: 20, max: 100, default: 60 },
    { key: "effectPower", label: "Effect Power", type: "slider", min: 0, max: 100, default: 100 },
  ],
  pixel: [
    { key: "cellSize", label: "Cell Size", type: "slider", min: 4, max: 32, default: 8 },
    { key: "gap", label: "Gap", type: "slider", min: 0, max: 8, default: 0 },
    { key: "showGrid", label: "Show Grid", type: "toggle", default: true },
    { key: "contrast", label: "Contrast", type: "slider", min: 0, max: 100, default: 50 },
    { key: "opacity", label: "Opacity", type: "slider", min: 0, max: 100, default: 100 },
  ],
  glass: [
    { key: "tileSize", label: "Tile Size", type: "slider", min: 8, max: 48, default: 23 },
    { key: "spiralTurns", label: "Turns", type: "slider", min: 0, max: 20, default: 10 },
    { key: "distortion", label: "Distortion", type: "slider", min: 0, max: 100, default: 55 },
    { key: "opacity", label: "Opacity", type: "slider", min: 0, max: 100, default: 100 },
    { key: "speed", label: "Speed", type: "slider", min: 0, max: 100, default: 25 },
  ],
  ascii: [
    { key: "cellSize", label: "Cell Size", type: "slider", min: 6, max: 24, default: 10 },
    { key: "gap", label: "Gap", type: "slider", min: 0, max: 8, default: 0 },
    { key: "contrast", label: "Contrast", type: "slider", min: 0, max: 100, default: 50 },
  ],
  blur: [
    { key: "cellSize", label: "Sample Size", type: "slider", min: 2, max: 24, default: 8 },
    { key: "blurAmount", label: "Blur", type: "slider", min: 1, max: 10, default: 4 },
    { key: "opacity", label: "Opacity", type: "slider", min: 0, max: 100, default: 100 },
  ],
  dither: [
    { key: "cellSize", label: "Cell Size", type: "slider", min: 2, max: 16, default: 4 },
    { key: "levels", label: "Levels", type: "slider", min: 2, max: 8, default: 4 },
    { key: "contrast", label: "Contrast", type: "slider", min: 0, max: 100, default: 50 },
  ],
  glitch: [
    { key: "offset", label: "RGB Offset", type: "slider", min: 0, max: 40, default: 12 },
    { key: "sliceHeight", label: "Slice Height", type: "slider", min: 2, max: 40, default: 8 },
    { key: "intensity", label: "Intensity", type: "slider", min: 0, max: 100, default: 50 },
  ],
  vintage: [
    { key: "sepia", label: "Sepia", type: "slider", min: 0, max: 100, default: 70 },
    { key: "grain", label: "Grain", type: "slider", min: 0, max: 100, default: 30 },
    { key: "vignette", label: "Vignette", type: "slider", min: 0, max: 100, default: 40 },
  ],
  cHtone: [
    { key: "cellSize", label: "Cell Size", type: "slider", min: 6, max: 32, default: 14 },
    { key: "angle", label: "Angle", type: "slider", min: 0, max: 180, default: 45 },
    { key: "opacity", label: "Opacity", type: "slider", min: 0, max: 100, default: 90 },
  ],
  imgTrack: [
    { key: "edgeThresh", label: "Edge Threshold", type: "slider", min: 10, max: 200, default: 80 },
    { key: "boxSize", label: "Box Size", type: "slider", min: 8, max: 64, default: 24 },
    { key: "maxRegions", label: "Max Regions", type: "slider", min: 1, max: 15, default: 6 },
  ],
  stage: [
    { key: "spotSize", label: "Spot Size", type: "slider", min: 20, max: 100, default: 55 },
    { key: "darkness", label: "Darkness", type: "slider", min: 0, max: 100, default: 70 },
    { key: "warmth", label: "Warmth", type: "slider", min: 0, max: 100, default: 40 },
  ],
};

export function getParamDefs(effectId: EffectId): ParamControl[] {
  return defs[effectId];
}

export function defaultParams(effectId: EffectId): Params {
  const p: Params = {};
  for (const d of defs[effectId]) {
    p[d.key] = d.default;
  }
  return p;
}

export function allDefaultParams(): Record<EffectId, Params> {
  const out = {} as Record<EffectId, Params>;
  for (const id of EFFECT_ORDER) out[id] = defaultParams(id);
  return out;
}
