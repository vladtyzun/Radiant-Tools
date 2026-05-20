# Architecture

## Overview

Pattern Generator is a **client-only** Next.js web app. All media processing runs in the browser via the Canvas 2D API. There is no API server or database.

```
┌─────────────────────────────────────────────────────────────┐
│  App (src/app/page.tsx)                                     │
│  ┌──────────────┐  ┌──────────────────────────────────────┐ │
│  │ Sidebar      │  │ CanvasPreview                         │ │
│  │ (controls)   │  │ source → offscreen → effect → display │ │
│  └──────────────┘  └──────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
         │                        │
         ▼                        ▼
   usePatternStore          requestAnimationFrame loop
   (React state)            src/lib/effects/*
```

## Layers

| Layer | Path | Responsibility |
|-------|------|----------------|
| UI | `src/components/` | Sidebar, sliders, shape grid, export |
| State | `src/hooks/usePatternStore.ts` | Effect params, source mode, playback |
| Effects | `src/lib/effects/` | Per-effect render functions |
| Shapes | `src/lib/shapes.ts` | Built-in paths + custom SVG parsing |
| Types | `src/lib/types.ts` | Effect IDs, param schemas |

## Data flow

1. **Source**: Image file, `<video>`, or `getUserMedia` webcam stream.
2. **Sample canvas**: Hidden canvas draws current frame at display resolution.
3. **Effect**: Reads pixel data (or region averages), writes pattern to output canvas.
4. **Display**: Main canvas shows result; export uses same bitmap.

## Performance

- Grid effects iterate cells, not every pixel (O(cells)).
- `willReadFrequently: true` on sample contexts when using `getImageData`.
- Video/webcam: one frame per `requestAnimationFrame`; skip if tab hidden (optional).

## Optional storage (not implemented)

Presets and custom SVG libraries would benefit from **localStorage** or IndexedDB. No server storage required unless sharing presets across devices.

## Deployment

Static export compatible; default Next.js SSR only wraps the shell. Vercel runs `next build` → Node server or static assets.
