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

### Password protection (optional locally, required in production)

The app can be gated with a shared password. **No database** — the bcrypt hash and session secret live in environment variables only.

| Variable | Purpose |
|----------|---------|
| `AUTH_PASSWORD_HASH` | bcrypt hash of your password (never store plaintext) |
| `AUTH_SECRET` | Random string, **32+ characters**, used to sign the session cookie |

**Local setup**

1. Copy `.env.example` to `.env.local` (gitignored).
2. Generate a secret: `openssl rand -base64 32` → set as `AUTH_SECRET`.
3. Generate a password hash: `npm run hash-password` (prompts securely; avoid putting the password on the command line).
4. Paste the printed `AUTH_PASSWORD_HASH=...` into `.env.local`.
5. Restart `npm run dev`.

If `AUTH_PASSWORD_HASH` is **not** set in development, auth is **disabled** and a console warning is printed. In **production** (Vercel), both variables are **required**; visitors see a configuration message until they are set.

**Why not a markdown file with the hash in the repo?**

Anyone with read access to the Git repository (or a public GitHub repo) can read committed files. Storing even a **hashed** password in `PASSWORD.md` still exposes your credential material to every collaborator and CI log. Hashes can be offline-attacked. Use **Vercel Environment Variables** (or `.env.local` only on your machine) for `AUTH_PASSWORD_HASH` and `AUTH_SECRET` instead.

**Vercel**

1. Project → **Settings** → **Environment Variables**.
2. Add `AUTH_PASSWORD_HASH` (from `npm run hash-password` on your machine).
3. Add `AUTH_SECRET` (`openssl rand -base64 32`).
4. Apply to **Production** (and Preview if you want the same gate on preview URLs).
5. Redeploy.

**Important:** On Vercel, set `AUTH_PASSWORD_HASH` to the **literal bcrypt string** (starts with `$2b$12$…`, 60 characters). Do **not** paste the backslash-escaped form from `.env.local` (`\$2b\$12$…` is only for local dotenv). Pasting through a shell or dashboard that strips `$` will make login always fail with “Invalid password”. Prefer the CLI without shell expansion:

```bash
printf '%s' '$2b$12$YOUR_HASH_HERE' | npx vercel env add AUTH_PASSWORD_HASH production
```

If you change the password locally (`npm run hash-password`), update Vercel’s `AUTH_PASSWORD_HASH` the same way and redeploy.

Sign out via **Sign out** at the bottom of the sidebar.

Run **only one** dev server for this project. Two `npm run dev` processes (e.g. terminal + IDE) race on `.next/cache/webpack` and can cause:

```text
[webpack.cache.PackFileCacheStrategy] Caching failed for pack: Error: ENOENT ... rename ... 0.pack.gz_
```

If the dev server crashes with missing `.next/server/app/page.js` (ENOENT), the build output is missing or was deleted — stop dev, then `rm -rf .next`, `npm run build` (or `npm run dev:clean`).

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
4. Set `AUTH_PASSWORD_HASH` and `AUTH_SECRET` (see **Password protection** above), then deploy.

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
