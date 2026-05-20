# UI Specification

Reference: dark sidebar mockups (`assets/IMG_966*.png` in Cursor project).

## Layout

- **Sidebar**: Fixed width ~320px, `bg-[#0a0a0a]`, full viewport height, scrollable.
- **Preview**: Flex-grow, black background, centered canvas with `object-fit: contain`.
- **Brand**: Small caps label (e.g. "PATTERN GEN"), effect title (24px bold white), subtitle (gray).

## Sections (top to bottom)

### SOURCE
- Upload button (full width) + square webcam toggle (active = red tint).
- Camera permission error message when denied.
- Export row: format `<select>` (PNG/JPG/SVG) + white primary Export button.

### EFFECT ANIMATION (always visible)
- Play/Pause — drives effect `animationTime` (default paused).
- Speed pills: 1x / 2x / 3x for effect animation.

### PLAYBACK (visible when video or webcam)
- Play/Pause for video element.
- Speed pills: 1x / 2x / 3x for video `playbackRate`.

### EFFECT
- 3-column grid of effect pills.
- Active: `bg-white text-black`; inactive: `bg-[#1a1a1a] text-white`.

Effects: Pattern, Halftone, Track, Dot Char, Pixel, Glass, ASCII, Blur, Dither, Glitch, Vintage, C. Htone, ImgTrack, Stage.

### Algorithm Mode (Pattern, Halftone, Dot Char, Pixel)
- Flat | Halftone | Inverse segmented control.

### Background (all effects)
- Dark, White, Paper, Navy, Custom (color input). Presets: `#0a0a0a`, `#ffffff`, `#f5f0e8`, `#1a2744`.

### SHAPE (Pattern only)
- 4-column icon grid: geometric shapes + Unicode dingbats (✢ ✦ ✳︎ ✕ ❖ ⦿) + SVG upload tile.

### PARAMETERS
- Dynamic list from `paramDefs[effectId]`.
- Control types: `slider`, `toggle`, `select`, `colorGrid`.

### Slider styling
- Full-width rounded track `#1a1a1a`.
- Label left, value right (white).
- Fill + vertical white thumb line (custom range input).

## Preview overlays
- Bottom-center: volume (optional) + play when video paused.
- Top-right on canvas: pause shortcut when playing.

## Tokens

| Token | Value |
|-------|-------|
| Sidebar bg | `#0a0a0a` |
| Panel / button | `#1a1a1a` |
| Muted text | `#666666` |
| Active | `#ffffff` on `#000000` text |
| Border radius | `12px` buttons, `16px` sliders |
