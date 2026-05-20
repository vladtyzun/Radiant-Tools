# Build & Deploy

## Prerequisites
- Node.js 18+
- npm

## Local development

```bash
cd "/Users/admin/Desktop/Cursor Projects/Pattern Generator"
npm install
npm run dev
```

Open http://localhost:3000

## Production build

```bash
npm run build
npm start
```

## Vercel

1. Push repo to GitHub.
2. Import project in Vercel dashboard.
3. Framework preset: **Next.js** (auto-detected).
4. Build command: `npm run build`; output: default.
5. No environment variables required.

Optional `vercel.json` is not required for standard Next.js 15 App Router.

## Quality checks

```bash
npm run lint
npm run build
```

## Project structure

```
docs/           ← source of truth (this folder)
src/app/        ← layout, globals, page
src/components/ ← Sidebar, CanvasPreview, controls
src/hooks/      ← usePatternStore
src/lib/        ← types, shapes, effects, paramDefs
```

## Troubleshooting

- **Webcam**: Requires HTTPS or localhost; user must grant permission.
- **Large images**: Resize sample canvas to max 1920px edge for performance.
- **CORS video**: Cross-origin videos may taint canvas; use uploaded files.
