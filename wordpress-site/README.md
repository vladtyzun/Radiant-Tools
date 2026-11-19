# wordpress-site

Tooling to manage and edit the studio's WordPress website from this repo. Content lives as plain files under `content/`, so edits are reviewable in git and can be made by hand or with Claude Code, then pushed to the live site through the WordPress REST API.

Zero dependencies — Node 18+ only.

## Setup

1. In WordPress: **Users → Profile → Application Passwords**, create one named e.g. `radiant-tools`.
2. `cp .env.example .env` and fill in `WP_URL`, `WP_USER`, `WP_APP_PASSWORD` (`.env` is git-ignored).
3. `npm run check` — should print the site name and `Auth OK`.

(The site must be served over HTTPS for application passwords to work, and the REST API must not be blocked by a security plugin.)

## Workflow

```bash
npm run pull                         # download pages + posts into content/
# edit content/pages/about.html (block markup is preserved as-is)
npm run push -- content/pages/about.html --dry-run
npm run push -- content/pages/about.html
```

| Command | What it does |
|---------|--------------|
| `npm run check` | Verify credentials |
| `npm run wp -- list pages\|posts\|media\|plugins\|themes` | Inspect the site |
| `npm run pull [-- pages\|posts]` | Download content (incl. drafts/private) |
| `npm run push -- <file...>` / `-- --all` | Update from files; a file without `id:` creates a new item. `--dry-run` previews |
| `npm run wp -- media <file...>` | Upload to the media library |
| `npm run backup` | JSON export of content/media/users/taxonomies to `backups/` (git-ignored) |
| `npm test` | Runs the client against a mock WordPress server |

### Content file format

```
---
id: 42
title: About
slug: about
status: publish        # publish | draft | private | pending | future
modified: 2025-01-01T10:00:00
---
<!-- wp:paragraph --><p>Raw post content (Gutenberg block markup)</p><!-- /wp:paragraph -->
```

To create a new page, add `content/pages/new-page.html` with `title`, `slug`, `status` (omit `id`) and push it; the file is rewritten with the assigned `id`.

### Safety

- `push` compares the file's `modified` stamp to the server and **refuses to overwrite** changes made in wp-admin since your last pull (exit code 1). Pull first, merge, or pass `--force`.
- Unchanged files are skipped.
- Nothing is deleted by this tool.
- Run `npm run backup` before large edits; it covers content only, so keep host-level backups of files and the database too.

## Not covered (yet)

Theme/plugin code, menus, widgets, WooCommerce data and Customizer settings aren't synced (REST support varies by site). Theme and plugin files should be managed via SFTP/Git deploy; they could live in `wp-content/` here later.

## Running in a proxied/cloud sandbox

Node's built-in `fetch` ignores `HTTPS_PROXY`. In Claude Code cloud sessions, prefix commands with:

```bash
NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt npm run check
```

The site's host must also be on the environment's allowed-hosts list. If the host's security plugin rate-limits you (HTTP 429), wait a minute and retry.

## Building Services & Industries pages from specs

`content-specs/*.json` hold the **copy** for the Services and Industries page tree. The builder
turns each spec into a WordPress **draft**, assembling the Elementor layout by cloning section
patterns from the existing "Our Services" page, so new pages inherit the site's fonts, colour
globals and widget styling instead of arriving as unstyled HTML.

```bash
node bin/build-pages.mjs --dry-run      # list specs, section counts, word counts
node bin/build-pages.mjs                # create/update the drafts
node bin/build-pages.mjs product-design # just one
```

`content-specs/built.json` maps each spec to the WordPress page id it created, so re-running
updates the same draft rather than creating duplicates. Edit the copy in the spec and re-run.

Section types available to a spec (`p`): `hero`, `intro`, `block` (challenge + list + CTA),
`cards3`, `steps3`, `proof`. Patterns and their patch paths live in `lib/elementor.mjs`;
`research/elementor/7363.json` is the cloned source and must stay in the repo.

Competitor research, screenshots and the IA analysis are in `research/`.

### SEO meta (All in One SEO)

Each spec can carry a `seo` block. AIOSEO exposes `aioseo_meta_data` on the standard `wp/v2`
endpoint, so the builder writes SEO fields in the same request that creates the page — neither
UiCore MCP nor Elementor MCP writes AIOSEO fields today (both target Yoast/Rank Math).

```json
"seo": {
  "title": "Product Design Studio for SaaS & Fintech | Radiant",
  "description": "We design SaaS platforms, dashboards and mobile products that move…",
  "keyphrase": "product design studio"
}
```

`--dry-run` prints title/description lengths and warns past 60/160 characters. `og_*` and
`twitter_*` are left empty on purpose so AIOSEO falls back to the SEO title and description;
set `og_title` / `og_description` in the spec only when a page needs different social copy.
Partial updates are safe — canonical URL, schema and image settings keep their values.

**To manage SEO for a page whose layout is hand-built** (e.g. the Services parent), add a spec with
`"seoOnly": true` and `"pageId": <id>`. It writes only the AIOSEO fields and never touches the
page's content or Elementor data.

> Never give a normal spec the key `page:services` — the builder would overwrite the hand-built
> parent page. Use a `seoOnly` spec for it instead.

### Previewing a draft (`bin/preview.mjs`)

Application passwords authenticate REST only, so a draft page cannot be fetched with a
browser and there is no way to *see* generated output from here. `bin/preview.mjs <pageId>`
works around that safely:

1. copies the page to a throwaway page with a random slug **and a random password**;
2. publishes the copy, then fetches it anonymously and **aborts unless the response is the
   password gate** — content is never served to an unauthenticated request, so there is
   nothing for a crawler to index;
3. screenshots at 1440 / 834 / 390 px using the `wp-postpass` cookie;
4. force-deletes the copy in a `finally` block, verifies it is gone, and checks `sitemap.xml`.

The real page stays a draft and its slug is never published.

**Known blocker:** the host's bot protection (adm.tools) serves a CAPTCHA/429 "Protected
section" page to this server's IP for *front-end* HTML requests, so screenshots come back as
the challenge page. The REST API is unaffected. To use this tool, allow the client IP in the
hosting bot-protection settings; otherwise previews must be done by a human in the browser.

### AIOSEO gotcha

Write SEO through `aioseo_meta_data` on `wp/v2/pages` only. The plugin's own
`POST /aioseo/v1/post` endpoint accepts a *partial* payload, returns `success: true`, and
silently resets the fields you left out — it wiped a page's SEO title and description during
testing. The `robots_*` flags are read-only over REST; set noindex in wp-admin.
