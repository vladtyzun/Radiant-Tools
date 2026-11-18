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
