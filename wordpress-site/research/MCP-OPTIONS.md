# Agent tooling for heyradiant.com — UiCore MCP vs Elementor MCP vs the REST pipeline

Checked 2026-11-18 against the live site and both vendors' own pages.

## What the site actually runs

| | |
|---|---|
| Theme | **UiCore Pro** + `uicore-pro-child` |
| Plugins | UiCore Framework 6.3.2, UiCore Elements 1.3.19, UiCore Animate 2.2.4 |
| Builder | **Elementor 4.4.1** — free; no Elementor Pro installed |
| Widgets in use | **Element Pack Pro 9.1.1** (`bdt-fancy-list`, `bdt-advanced-button`, `bdt-animated-link`, `bdt-logo-grid`) + UiCore widgets |
| SEO | **All in One SEO Pro 5.0.5.1** (not Yoast, not Rank Math) |
| Security | All-In-One Security — rate-limits REST writes (429) and blocks headless browsers (403) |

## 1. UiCore MCP — exists, beta, best fit

Part of UiCore's "Ai Agency Suite". npm package `@uicoreco/mcp`, latest **0.3.0, first published 2026-10-28**.

Setup: enable MCP in **Theme Options → Admin** (off by default), run `npx @uicoreco/mcp setup yoursite.com`
(Node 18+), approve the connection once in WordPress. Configures Claude, Claude Code, Cursor, VS Code,
Codex and Windsurf automatically. Uses your own AI subscription — no extra model cost.

Vendor claims, quoted:
- "Real UiCore widgets and blocks, global colors and theme typography. **No raw HTML.**"
- "The agent reads your colors, fonts, logos and copy rules before it writes a line."
- "Every page is tested on desktop, tablet and phone before you see it."
- Agent can access "Pages, posts and portfolio items, Theme Builder templates, the Brand Kit and theme
  settings, menus, media, SEO fields and ACF fields."

Safety: admin approves the connection; new pages and templates are created as **drafts with a private
preview link**; every change is snapshotted for one-step undo; custom PHP needs admin sign-off; full audit log.

**Caveats that matter for this site:**
- ⚠️ "Edits to pages that are already live, and to global settings, **apply when they are made**."
  Only *new* pages are draft-first.
- ⚠️ Builds with **UiCore Elements widgets or UiCore Blocks**. Our existing pages lean heavily on
  **Element Pack Pro** `bdt-*` widgets, which are not UiCore's. Expect global colours and typography to
  carry over, but not our existing Element Pack section patterns.
- ⚠️ SEO fields are written "through **Yoast SEO or Rank Math**". We run **All in One SEO Pro** — likely unsupported.
- ⚠️ Beta, off by default, 0.3.0, three weeks old at time of writing.
- Licensing: "MCP Integration" is listed on every UiCore PRO plan; the wider **AI Agency Suite**
  (Brand Screening, Master Brand Kit, Brand Refiner) appears only on the higher tiers. Confirm against
  the actual licence in the UiCore account.

## 2. Elementor MCP — official, but a weaker fit here

Official, set up from **Elementor → Elementor MCP** in wp-admin; Elementor generates the application
password and a setup prompt to paste into the AI tool. Output lands as a draft in native Elementor structure.

**Why it fits this site poorly:**
- ⚠️ "The MCP currently supports **Atomic Elements** and will soon also support Widget (V3) layouts."
  Our pages are classic containers plus Element Pack widgets — the MCP would build in a different
  element system than the rest of the site.
- ⚠️ Several headline features — edits and redesigns of existing pages, design systems, other plugins'
  abilities — are marked **"Requires Angie"** (separate free plugin).
- ⚠️ "Unlock more of the MCP with Pro": Forms, Popups, Loops, Components, Dynamic Content, Headers and
  Footers are Pro-gated. **We are on free Elementor**, so that surface is unavailable.

## 3. The REST + pattern-cloning pipeline in this repo

What it already does: clones real section patterns out of the existing Services page — Element Pack
widgets included — re-ids them, and patches the copy, so output is indistinguishable from hand-built
sections. Copy lives in `content-specs/*.json` under version control, with review history and repeatable
re-runs.

Limits: it can only recombine patterns that already exist on the site; it cannot invent a new layout,
and it does no responsive QA.

Worth noting: AIOSEO exposes `aioseo_meta_data` on the REST page object, so **this pipeline can write our
SEO titles and descriptions** even though UiCore MCP reportedly cannot.

## Recommendation

1. **Try UiCore MCP on a staging copy first**, not production — it is beta, and edits to live pages apply
   immediately. It is the only option that reads the Brand Kit and builds with the theme's own widgets.
2. **Keep the spec pipeline for copy.** Page text that needs review history, diffs and repeatable
   rebuilds belongs in git, not in a chat transcript.
3. **Skip Elementor MCP for now.** Revisit when it supports Widget (V3) layouts, or if we move to Elementor Pro.
4. Before trusting either agent on this site, check how Element Pack sections and AIOSEO fields survive.

Setup has to happen on Vlad's own machine: `npx @uicoreco/mcp setup` configures a local MCP client, and
enabling MCP lives in the Theme Options admin UI, which the REST API cannot reach.
