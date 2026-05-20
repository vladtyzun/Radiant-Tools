# Pattern Generator

Real-time pattern effects over images, video, and webcam — client-side Canvas processing with a dark sidebar UI.

## Docs (source of truth)

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/UI_SPEC.md](docs/UI_SPEC.md)
- [docs/EFFECTS.md](docs/EFFECTS.md)
- [docs/BUILD.md](docs/BUILD.md)

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Run **only one** dev server for this project. Two `npm run dev` processes (e.g. terminal + IDE) race on `.next/cache/webpack` and can cause:

```text
[webpack.cache.PackFileCacheStrategy] Caching failed for pack: Error: ENOENT ... rename ... 0.pack.gz_
```

If that appears, stop extra dev servers, then:

```bash
npm run dev:clean
```

(`dev:clean` deletes `.next` and starts a fresh dev server.) Or manually: `rm -rf .next` then `npm run dev`.

## Build

```bash
npm run build
npm start
```

## Deploy to Vercel

1. Push this folder to a Git repository.
2. Import the repo in [Vercel](https://vercel.com).
3. Framework: **Next.js** (defaults are fine).
4. Deploy — no environment variables required.

## Track mode (hands & eyes)

Track uses **MediaPipe Tasks Vision** in the browser (`@mediapipe/tasks-vision`):

| Asset | Source |
|-------|--------|
| WASM runtime | `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm` |
| Hand model | `hand_landmarker.task` on `storage.googleapis.com/mediapipe-models/…` |
| Face model | `face_landmarker.task` on `storage.googleapis.com/mediapipe-models/…` |

Models load lazily when you select Track (first load needs network). Toggle **Hands**, **Eyes**, and **Motion Regions** in the sidebar.

**How to test:** `npm run dev` → upload a video with visible hands/face or enable webcam → select **Track** → adjust sensitivity/box style and confirm the video frame aspect stays fixed while overlays update.

## Features

- Upload image/video or use live webcam
- Effects: Pattern, Halftone, Track (motion + hand skeleton + eye highlights), Dot Char, Pixel, Glass, ASCII, and more
- Algorithm modes (Pattern): Flat, Halftone, Inverse
- Shape grid + custom SVG upload
- Background presets and export PNG/JPG
- Video playback: play/pause, 1x/2x/3x speed

## Storage

Everything runs in the browser. **localStorage** is optional if you add preset saving later; no server database is required for core use.
# Radiant-Tools
# Radiant-Tools
