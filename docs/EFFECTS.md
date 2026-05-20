# Effects Logic

## Shared concepts

### Grid sampling
For cell `(cx, cy)` with size `cellSize` and gap `gap`:
- Sample rectangle at center of cell from source image data.
- **Luminance** `L = 0.299R + 0.587G + 0.114B` (0–255).

### Effect animation
- **Effect Animation** (sidebar): Play/Pause + 1x/2x/3x drives `animationTime` via rAF when playing. Default is paused (static frame).
- Time-based effects (Glass spiral phase, Stage spotlight drift, Vintage grain) advance `time` only while playing.
- **Glitch** always renders RGB split, block nudges, and slice shifts when paused; static mode uses a param-derived seed (stable per settings). Play advances the seed over time.
- **Playback** (video/webcam only): separate controls for `HTMLVideoElement` play rate.

### Focal point
- Normalized `focalPoint` `{ x, y }` (0–1), default center. Draggable cyan handle on the preview canvas.
- `getFocalWeight(nx, ny, focal, enabled)` in `render.ts`: smooth falloff from 1.0 at the focal point to ~0.25 at the farthest canvas edge.
- Applied to Glitch, Glass, Stage, Vintage, Pattern, Halftone, Pixel when **Focal Point** is on. Toggle off or **Center** resets position.

### Algorithm modes (Pattern, Halftone, Dot Char, Pixel)
| Mode | Behavior |
|------|----------|
| Flat | Shape filled with sampled color; size fixed by `shapeScale`. |
| Halftone | Shape size ∝ `(255 - L) / 255 * effectPower`. |
| Inverse | Shape size ∝ `L / 255`; optional invert flips mapping. |

### Shapes
Built-in paths in `shapes.ts` (circle, square, cross, ring, triangle, star, diamond, hex). Unicode dingbats (✢ ✦ ✳︎ ✕ ❖ ⦿) render via centered `fillText` / SVG `<text>`. Custom SVG: parse `<path>` / simple shapes → `Path2D`, normalized to unit box, scaled per cell.

---

## Pattern
Repeating grid of shapes over media. Params: cellSize, gap, contrast, opacity, threshold, shapeScale, invert.

## Halftone
Circular dots only; dot radius from luminance. Params: cellSize, gap, contrast, opacity, minDot, maxDot, threshold.

## Track
Combines optional motion-region boxes, MediaPipe hand skeleton, and face eye highlights over letterboxed media.

### Aspect ratio
- **Display** canvas size is derived only from source intrinsic dimensions (`videoWidth`/`Height` or image `naturalWidth`/`Height`), capped at 960px edge.
- **Render** buffer samples at up to 1280px edge for detection and motion diff.
- Media is composited with letterboxing into the display buffer; Track params (sensitivity, block size, box style) do not resize the preview.

### Motion regions (fallback / optional)
Frame-to-frame diff per coarse block; boxes drawn in render space then scaled with the letterboxed blit. Toggle **Motion Regions**. Params: boxStyle, sensitivity, maxRegions, boxColor, invert, cellSize (block size only).

### Hands & eyes (MediaPipe)
- Lazy-loaded when Track is selected: `@mediapipe/tasks-vision` HandLandmarker + FaceLandmarker.
- WASM/runtime from jsDelivr CDN; `.task` models from Google Cloud Storage (see README).
- Detection throttled to ~20fps on video/webcam.
- **Hands**: `HandLandmarker.HAND_CONNECTIONS` skeleton; extra lines between fingertips when spread.
- **Eyes**: diamond + ellipse markers at eye landmark centers (cyan by default), distinct from rectangular motion boxes.
- Params: trackHands, trackEyes, handSkeleton, trackMotion, skeletonLineWidth, eyeHighlightSize, boxColor, eyeColor.

If models fail to load, sidebar shows a warning; motion tracking still works when enabled.

## Dot Char
Halftone dots + ASCII character from luminance charset. Params: cellSize, gap, contrast, baseScale, effectPower, charset density.

## Pixel
Mosaic blocks + optional grid lines. Params: cellSize, gap, showGrid, contrast, opacity.

## Glass
Spiral tile distortion from center. **Turns** (`spiralTurns`, 0–20): 0 = passthrough (source image only); 20 = full effect. Distortion and spiral strength scale linearly with `turns / 20`. Works in static mode (no Play required). Params: tileSize, turns, distortion, opacity, speed (animation phase only while playing).

## ASCII
Character per cell from luminance. Params: cellSize, gap, contrast, charset.

## Blur / Dither / Glitch / Vintage / C. Htone / ImgTrack / Stage
Stylized filters: blur stack, ordered dither, RGB split + slice/block glitch, sepia, CMYK-style dots, edge boxes, radial stage vignette. Each exposes 3–6 sliders in `paramDefs`. Glitch does not require Effect Animation Play.

---

## Export
- **PNG / JPG**: `canvas.toDataURL` → download. Video/webcam: current frame only.
- **SVG**: Grid effects (Pattern, Halftone, Pixel, Dot Char) export vector shapes from the same cell sampling as the canvas. Other effects embed a raster `<image>` inside SVG.

## Background presets
Applied behind shapes via `bgColor` in `renderEffect`: Dark `#0a0a0a`, White `#ffffff`, Paper `#f5f0e8`, Navy `#1a2744`, Custom (color input). Inverse algorithm mode may use background color for bright cells.

---

## Webcam / Video
- Video: `HTMLVideoElement`, `playbackRate` from Playback speed.
- Webcam: `getUserMedia`, stream on hidden video, mirrored draw, `loadeddata`/`canplay` before sampling. Tracks stopped when camera toggled off.
