export type EffectId =
  | "pattern"
  | "halftone"
  | "track"
  | "dotChar"
  | "pixel"
  | "glass"
  | "ascii"
  | "blur"
  | "dither"
  | "glitch"
  | "vintage"
  | "cHtone"
  | "imgTrack"
  | "stage";

export type FocalPoint = { x: number; y: number };

export type AlgorithmMode = "flat" | "halftone" | "inverse";

export type ShapeId =
  | "circle"
  | "square"
  | "cross"
  | "ring"
  | "triangle"
  | "star"
  | "diamond"
  | "hex"
  | "pinwheel"
  | "sparkle"
  | "asterisk"
  | "multiply"
  | "diamondCross"
  | "bullseye"
  | "custom";

export type BackgroundPreset = "dark" | "white" | "paper" | "navy" | "custom";

export type SourceMode = "none" | "image" | "video" | "webcam";

export type BoxStyle = "frame" | "solid" | "dash" | "dot";

export type ParamValue = number | boolean | string;

export type Params = Record<string, ParamValue>;

export type ParamControl =
  | {
      key: string;
      label: string;
      type: "slider";
      min: number;
      max: number;
      step?: number;
      default: number;
    }
  | {
      key: string;
      label: string;
      type: "toggle";
      default: boolean;
    }
  | {
      key: string;
      label: string;
      type: "select";
      options: { value: string; label: string }[];
      default: string;
    }
  | {
      key: string;
      label: string;
      type: "colorGrid";
      colors: string[];
      default: string;
    };

export const EFFECT_LABELS: Record<EffectId, { title: string; subtitle: string }> = {
  pattern: { title: "Pattern", subtitle: "Grid of shapes over media" },
  halftone: { title: "Halftone", subtitle: "Variable dot size from luminance" },
  track: { title: "Track", subtitle: "Hands, eyes & motion" },
  dotChar: { title: "Dot Char", subtitle: "Halftone dots + characters" },
  pixel: { title: "Pixel", subtitle: "Mosaic blocks with grid" },
  glass: { title: "Glass", subtitle: "Spiral tile distortion" },
  ascii: { title: "ASCII", subtitle: "Character mosaic" },
  blur: { title: "Blur", subtitle: "Stacked blur sampling" },
  dither: { title: "Dither", subtitle: "Ordered dither pattern" },
  glitch: { title: "Glitch", subtitle: "RGB channel offset" },
  vintage: { title: "Vintage", subtitle: "Sepia and grain" },
  cHtone: { title: "C. Htone", subtitle: "Color halftone dots" },
  imgTrack: { title: "ImgTrack", subtitle: "Edge region highlight" },
  stage: { title: "Stage", subtitle: "Radial spotlight vignette" },
};

export const BACKGROUND_COLORS: Record<Exclude<BackgroundPreset, "custom">, string> = {
  dark: "#0a0a0a",
  white: "#ffffff",
  paper: "#f5f0e8",
  navy: "#1a2744",
};

export type ExportFormat = "png" | "jpg" | "svg";

export const GRID_ALGORITHM_EFFECTS: EffectId[] = ["pattern", "halftone", "dotChar", "pixel"];

/** Effects whose preview changes over time when Play is active (see render.ts). */
export const ANIMATED_EFFECTS: EffectId[] = ["glass", "glitch", "stage", "vintage"];
