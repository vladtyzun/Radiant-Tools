"use client";

import { memo } from "react";
import { getParamDefs, EFFECT_ORDER } from "@/lib/paramDefs";
import { EFFECT_LABELS, GRID_ALGORITHM_EFFECTS } from "@/lib/types";
import { SHAPE_OPTIONS } from "@/lib/shapes";
import { BACKGROUND_COLORS } from "@/lib/types";
import type { PatternStore } from "@/hooks/usePatternStore";
import type { EffectId } from "@/lib/types";
import { Section } from "./Section";
import { ParamSlider } from "./ParamSlider";
import { ToggleSwitch } from "./ToggleSwitch";
import { parseSvgToPath } from "@/lib/shapes";

type Props = PatternStore & {
  onUpload: (file: File) => void;
  onExport: () => void;
  hasMedia: boolean;
  isVideoSource: boolean;
  cameraError?: string | null;
  trackMlStatus?: string | null;
};

const pillActive = "bg-white font-medium text-black";
const pillIdle = "bg-panel text-white hover:bg-[#262626]";

const BG_SWATCH_PRESETS = (
  ["dark", "white", "paper", "navy"] as const
).map((id) => ({ id, color: BACKGROUND_COLORS[id] }));

function ChevronDownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function SidebarInner(props: Props) {
  const {
    effectId,
    setEffectId,
    params,
    setParam,
    algorithmMode,
    setAlgorithmMode,
    shapeId,
    setShapeId,
    setCustomPath,
    bgPreset,
    setBgPreset,
    customBg,
    setCustomBg,
    useFocalPoint,
    setUseFocalPoint,
    resetFocalPoint,
    videoPlaying,
    setVideoPlaying,
    videoSpeed,
    setVideoSpeed,
    exportFormat,
    setExportFormat,
    webcamOn,
    setWebcamOn,
    onUpload,
    onExport,
    hasMedia,
    isVideoSource,
    cameraError,
    trackMlStatus,
  } = props;

  const paramDefs = getParamDefs(effectId);
  const showAlgorithm = GRID_ALGORITHM_EFFECTS.includes(effectId);
  const showShape = effectId === "pattern";
  return (
    <aside className="flex h-full w-[300px] shrink-0 flex-col overflow-y-auto rounded-xl border border-[#333] bg-sidebar text-white shadow-lg">
      <header className="px-3 pb-4 pt-3">
        <p className="text-[10px] text-muted">Pattern generator</p>
        <h1 className="mt-0.5 text-xl font-bold">Radiant Pattern</h1>
      </header>

      <Section title="Source">
        <div className="flex gap-1.5">
          <label className="flex h-8 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-panel text-[13px] hover:bg-[#262626]">
            <UploadIcon />
            Upload Image / Video
            <input
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUpload(f);
                e.target.value = "";
              }}
            />
          </label>
          <button
            type="button"
            onClick={() => setWebcamOn(!webcamOn)}
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
              webcamOn ? "bg-red-600" : "bg-panel"
            }`}
            title="Webcam"
          >
            <CameraIcon />
          </button>
        </div>
        {cameraError && <p className="mt-1 text-[10px] text-red-400">{cameraError}</p>}
        {hasMedia && (
          <div className="mt-1.5 flex gap-1.5">
            <div className="relative flex flex-1 items-center">
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as "png" | "jpg" | "svg")}
                className="h-8 w-full appearance-none rounded-lg bg-panel py-0 pl-2 pr-8 text-[13px] outline-none"
              >
                <option value="png">PNG</option>
                <option value="jpg">JPG</option>
                <option value="svg">SVG</option>
              </select>
              <span
                className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted"
                aria-hidden
              >
                <ChevronDownIcon />
              </span>
            </div>
            <button
              type="button"
              onClick={onExport}
              className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-white px-2 text-[13px] font-medium text-black"
            >
              <DownloadIcon />
              Export
            </button>
          </div>
        )}
      </Section>

      {hasMedia &&
        effectId !== "glass" &&
        effectId !== "fractalGlass" &&
        effectId !== "glitch" && (
        <Section title="Focal Point">
          <div className="flex items-center gap-1.5">
            <div className="flex flex-1 items-center justify-between rounded-lg bg-panel px-2.5 py-1.5">
              <span className="text-[13px]">Enable</span>
              <ToggleSwitch
                checked={useFocalPoint}
                onChange={setUseFocalPoint}
                aria-label="Focal point"
              />
            </div>
            <button
              type="button"
              onClick={resetFocalPoint}
              className="flex h-8 min-w-0 flex-1 items-center justify-center rounded-lg bg-panel text-[13px] text-muted hover:bg-[#262626] hover:text-white"
            >
              Center
            </button>
          </div>
          <p className="mt-1 text-[9px] leading-snug text-muted">
            Drag the cyan handle on the preview; effects are strongest at the focal point
          </p>
        </Section>
      )}

      {hasMedia && isVideoSource && (
        <Section title="Playback">
          <SpeedControlRow
            playing={videoPlaying}
            onTogglePlay={() => setVideoPlaying(!videoPlaying)}
            speed={videoSpeed}
            onSpeed={setVideoSpeed}
          />
          <p className="mt-1 text-[9px] text-muted">Video / webcam playback speed</p>
        </Section>
      )}

      {hasMedia && (
        <>
          <Section title="Effect">
            <div className="grid grid-cols-3 gap-1">
              {EFFECT_ORDER.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setEffectId(id)}
                  className={`rounded-md px-0.5 py-1.5 text-[13px] leading-tight ${
                    effectId === id ? pillActive : pillIdle
                  }`}
                >
                  {formatEffectLabel(id)}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[9px] leading-snug text-muted">
              {EFFECT_LABELS[effectId].subtitle}
            </p>
            {(effectId === "track" || effectId === "imgTrack") && (
              <p className="mt-0.5 text-[9px] leading-snug text-muted/80">
                {effectId === "track"
                  ? "Video motion diff + optional MediaPipe hand/eye overlays. Needs motion or ML toggles on."
                  : "Single-frame edge detection boxes only — no motion diff or MediaPipe."}
              </p>
            )}
          </Section>

          {showAlgorithm && (
            <Section title="Algorithm Mode">
              <div className="flex gap-0.5 rounded-lg bg-panel p-0.5">
                {(["flat", "halftone", "inverse"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setAlgorithmMode(m)}
                    className={`h-7 flex-1 rounded-md text-[13px] capitalize ${
                      algorithmMode === m ? pillActive : "text-muted"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </Section>
          )}

          <Section title="Background">
            <div className="flex flex-wrap items-center gap-2">
              {BG_SWATCH_PRESETS.map(({ id, color }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setBgPreset(id)}
                  aria-label={id}
                  className={`h-8 w-8 shrink-0 rounded-md border border-[#333] ${
                    bgPreset === id ? "ring-2 ring-white ring-offset-2 ring-offset-sidebar" : ""
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
              <label
                className={`relative h-8 w-8 shrink-0 cursor-pointer overflow-hidden rounded-md border border-[#333] ${
                  bgPreset === "custom"
                    ? "ring-2 ring-white ring-offset-2 ring-offset-sidebar"
                    : ""
                }`}
                title="Custom color"
              >
                <span
                  className="block h-full w-full"
                  style={{ backgroundColor: customBg }}
                />
                <input
                  type="color"
                  value={customBg}
                  onChange={(e) => {
                    setCustomBg(e.target.value);
                    setBgPreset("custom");
                  }}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  aria-label="Custom background color"
                />
              </label>
            </div>
          </Section>

          {showShape && (
            <Section title="Shape">
              <div className="grid grid-cols-4 gap-1">
                {SHAPE_OPTIONS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setShapeId(s.id)}
                    className={`aspect-square rounded-md text-base ${
                      shapeId === s.id ? pillActive : "bg-panel"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
                <label
                  className={`flex aspect-square cursor-pointer items-center justify-center rounded-md text-[13px] ${
                    shapeId === "custom" ? pillActive : "bg-panel"
                  }`}
                >
                  SVG
                  <input
                    type="file"
                    accept=".svg,image/svg+xml"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const text = await f.text();
                      const path = parseSvgToPath(text);
                      if (path) {
                        setCustomPath(path);
                        setShapeId("custom");
                      }
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
            </Section>
          )}

          {effectId === "track" && trackMlStatus && (
            <p className="mx-3 mb-4 rounded-lg bg-panel px-2 py-1.5 text-[10px] text-amber-200/90">
              {trackMlStatus}
            </p>
          )}

          <Section title="Parameters">
            {paramDefs.map((def) => {
              if (def.type === "slider") {
                return (
                  <ParamSlider
                    key={def.key}
                    label={def.label}
                    value={Number(params[def.key] ?? def.default)}
                    min={def.min}
                    max={def.max}
                    step={def.step}
                    onChange={(v) => setParam(def.key, v)}
                  />
                );
              }
              if (def.type === "toggle") {
                const on = Boolean(params[def.key] ?? def.default);
                return (
                  <div
                    key={def.key}
                    className="mb-1 flex items-center justify-between rounded-lg bg-panel px-2.5 py-1.5"
                  >
                    <span className="text-[13px]">{def.label}</span>
                    <ToggleSwitch
                      checked={on}
                      onChange={(v) => setParam(def.key, v)}
                      aria-label={def.label}
                    />
                  </div>
                );
              }
              if (def.type === "select") {
                const val = String(params[def.key] ?? def.default);
                return (
                  <div key={def.key} className="mb-2">
                    <p className="mb-1 text-[13px] uppercase text-muted">{def.label}</p>
                    <div className="grid grid-cols-4 gap-0.5">
                      {def.options.map((o) => (
                        <button
                          key={o.value}
                          type="button"
                          onClick={() => setParam(def.key, o.value)}
                          className={`h-7 rounded-md text-[13px] ${
                            val === o.value ? pillActive : "bg-panel"
                          }`}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              }
              if (def.type === "colorGrid") {
                const val = String(params[def.key] ?? def.default);
                return (
                  <div key={def.key} className="mb-2">
                    <p className="mb-1 text-[13px] uppercase text-muted">{def.label}</p>
                    <div className="grid grid-cols-5 gap-1.5">
                      {def.colors.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setParam(def.key, c)}
                          className="aspect-square max-h-7 rounded-full"
                          style={{
                            background: c,
                            boxShadow: val === c ? "0 0 0 2px #fff" : undefined,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                );
              }
              return null;
            })}
          </Section>
        </>
      )}

      <footer className="mt-auto border-t border-white/10 p-3">
        <LogoutButton />
      </footer>
    </aside>
  );
}

function LogoutButton() {
  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <button
      type="button"
      onClick={() => void handleLogout()}
      className="h-8 w-full rounded-lg bg-panel text-[13px] text-muted hover:bg-[#262626] hover:text-white"
    >
      Sign out
    </button>
  );
}

function SpeedControlRow({
  playing,
  onTogglePlay,
  speed,
  onSpeed,
}: {
  playing: boolean;
  onTogglePlay: () => void;
  speed: 1 | 2 | 3;
  onSpeed: (s: 1 | 2 | 3) => void;
}) {
  return (
    <div className="flex gap-1">
      <button
        type="button"
        onClick={onTogglePlay}
        className="flex h-7 flex-1 items-center justify-center rounded-lg bg-panel text-[13px]"
      >
        {playing ? "Pause" : "Play"}
      </button>
      {([1, 2, 3] as const).map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onSpeed(s)}
          className={`h-7 w-9 rounded-lg text-[13px] ${
            speed === s ? "bg-[#333] text-white" : "bg-panel text-muted"
          }`}
        >
          {s}x
        </button>
      ))}
    </div>
  );
}

function formatEffectLabel(id: EffectId) {
  const map: Partial<Record<EffectId, string>> = {
    cHtone: "C. Htone",
    imgTrack: "ImgTrack",
    dotChar: "Dot Char",
    motionBlur: "Motion Blur",
    fractalGlass: "Fractal",
  };
  return map[id] || id.charAt(0).toUpperCase() + id.slice(1);
}

function UploadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
    </svg>
  );
}

export const Sidebar = memo(SidebarInner);
