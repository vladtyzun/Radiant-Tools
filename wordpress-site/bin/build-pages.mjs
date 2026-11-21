#!/usr/bin/env node
/**
 * Build WordPress draft pages from the JSON specs in content-specs/.
 *
 *   node bin/build-pages.mjs --dry-run        # show what would be created
 *   node bin/build-pages.mjs                  # create/update drafts
 *   node bin/build-pages.mjs services/product-design
 *
 * Specs hold the copy; Elementor layout is cloned from existing site sections
 * (see lib/elementor.mjs) so new pages match the current design system.
 * A spec that has been built once records its WordPress id in built.json, so
 * re-running updates the same draft instead of creating duplicates.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnv, ROOT } from '../lib/env.mjs';
import { WP } from '../lib/client.mjs';
import { loadPatterns, section, metaFor } from '../lib/elementor.mjs';

const SPEC_DIR = join(ROOT, 'content-specs');
const STATE = join(SPEC_DIR, 'built.json');
const CTA_HREF = '/#contact';

/**
 * Sections are declared in specs as { "p": "<pattern>", ...values, "rows": [...] }.
 * Slot names in lib/patterns.mjs match the spec keys, so no per-pattern mapping
 * table is needed here — add a pattern there and specs can use it immediately.
 */
function buildElementor(spec, patterns) {
  return spec.sections.map((entry, i) => {
    try {
      return section(entry, patterns);
    } catch (e) {
      throw new Error(`${spec.slug} section ${i} (${entry.p}): ${e.message}`);
    }
  });
}

/** Readable HTML for post_content: the SEO fallback and what lands in content/. */
function specToHtml(spec) {
  const out = [];
  const esc = (v) => String(v ?? '');
  for (const s of spec.sections) {
    if (s.h1) out.push(`<h1>${esc(s.h1).replace(/\n/g, '<br>')}</h1>`);
    if (s.lead) out.push(`<p>${esc(s.lead)}</p>`);
    if (s.eyebrow) out.push(`<h2>${esc(s.eyebrow)}</h2>`);
    if (s.heading) out.push(`<h2>${esc(s.heading)}</h2>`);
    if (s.body) out.push(`<p>${esc(s.body)}</p>`);
    if (s.label) out.push(`<h2>${esc(s.label)}</h2>`);
    if (s.challenge) out.push(`<h3>${esc(s.challengeTitle || 'The challenge')}</h3><p>${esc(s.challenge)}</p>`);
    if (s.items) out.push(`<h3>${esc(s.deliverTitle || 'We deliver')}</h3><ul>${s.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`);
    if (s.quote) out.push(`<blockquote><p>${esc(s.quote)}</p><cite>${esc(s.name)}, ${esc(s.role)}</cite></blockquote>`);
    for (const r of s.rows || []) {
      if (r.title || r.name) out.push(`<h3>${esc(r.title || r.name)}</h3>`);
      if (r.body) out.push(`<p>${esc(r.body)}</p>`);
      const chips = [r.chip0, r.chip1, r.chip2, r.chip3].filter(Boolean);
      if (chips.length) out.push(`<ul>${chips.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>`);
      if (r.items) out.push(`<ul>${r.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`);
    }
  }
  return out.join('\n');
}

/**
 * Map a spec's `seo` block onto All in One SEO's REST field.
 * AIOSEO exposes `aioseo_meta_data` on the standard wp/v2 endpoint and accepts a
 * partial object, so unlisted keys (canonical, schema, image settings) keep their values.
 * og_* and twitter_* are left empty on purpose: AIOSEO falls back to the SEO
 * title/description, which is what we want unless a page needs different social copy.
 */
const SEO_LIMITS = { title: 60, description: 160 };

function seoPayload(spec) {
  const seo = spec.seo;
  if (!seo) return null;
  const out = { title: seo.title, description: seo.description };
  if (seo.keyphrase) out.keyphrases = { focus: { keyphrase: seo.keyphrase }, additional: [] };
  if (seo.og_title) out.og_title = seo.og_title;
  if (seo.og_description) out.og_description = seo.og_description;
  if (seo.canonical_url) out.canonical_url = seo.canonical_url;
  return out;
}

/** Warn (never block) when a title or description will be truncated in results. */
function seoWarnings(spec) {
  if (!spec.seo) return ['no seo block'];
  const w = [];
  for (const [field, max] of Object.entries(SEO_LIMITS)) {
    const v = spec.seo[field];
    if (!v) { w.push(`missing ${field}`); continue; }
    if (v.length > max) w.push(`${field} ${v.length}>${max}`);
  }
  if (!spec.seo.keyphrase) w.push('no keyphrase');
  return w;
}

const args = process.argv.slice(2);
const dry = args.includes('--dry-run');
const verbose = args.includes('--verbose');
const only = args.filter((a) => !a.startsWith('--'));

const specs = readdirSync(SPEC_DIR)
  .filter((f) => f.endsWith('.json') && f !== 'built.json')
  .map((f) => JSON.parse(readFileSync(join(SPEC_DIR, f), 'utf8')))
  .filter((s) => !only.length || only.includes(s.slug) || only.includes(s.key));

const patterns = loadPatterns();
const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : {};
const wp = dry ? null : new WP(loadEnv());

// Parents must exist before children can be attached to them.
specs.sort((a, b) => (a.parentKey ? 1 : 0) - (b.parentKey ? 1 : 0));

for (const spec of specs) {
  // A `seoOnly` spec manages SEO meta for a page whose layout is hand-built.
  // It never sends content or _elementor_data, so the existing page is untouched.
  if (spec.seoOnly) {
    const id = spec.pageId || state[spec.key]?.id;
    if (!id) throw new Error(`${spec.key}: seoOnly spec needs a pageId`);
    if (dry) {
      console.log(`${(spec.slug || spec.key).padEnd(26)} SEO-ONLY -> #${id}  ${seoWarnings(spec).join(', ') || 'ok'}`);
      continue;
    }
    await wp.json(`/pages/${id}`, 'POST', { aioseo_meta_data: seoPayload(spec) });
    console.log(`seo only  #${id}  ${spec.slug || spec.key}`);
    await new Promise((r) => setTimeout(r, 3000));
    continue;
  }
  const data = buildElementor(spec, patterns);
  const words = specToHtml(spec).replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  if (dry) {
    const warn = seoWarnings(spec);
    const t = spec.seo?.title || '';
    const d = spec.seo?.description || '';
    console.log(`${spec.slug.padEnd(26)} ${String(spec.sections.length).padStart(2)}s ${String(words).padStart(4)}w  seo:${String(t.length).padStart(2)}/${String(d.length).padStart(3)}  ${warn.length ? 'WARN ' + warn.join(', ') : 'ok'}`);
    if (verbose) console.log(`   T: ${t}\n   D: ${d}\n   K: ${spec.seo?.keyphrase || '-'}`);
    continue;
  }
  const payload = {
    title: spec.title,
    slug: spec.slug,
    status: 'draft',
    content: specToHtml(spec),
    meta: metaFor(data),
  };
  const seo = seoPayload(spec);
  if (seo) payload.aioseo_meta_data = seo;
  if (spec.parentKey) {
    const parentId = state[spec.parentKey]?.id;
    if (!parentId) throw new Error(`${spec.slug}: parent "${spec.parentKey}" not built yet`);
    payload.parent = parentId;
  }
  const existing = state[spec.key]?.id;
  const res = existing
    ? await wp.json(`/pages/${existing}`, 'POST', payload)
    : await wp.json('/pages', 'POST', payload);
  state[spec.key] = { id: res.id, slug: res.slug, link: res.link };
  writeFileSync(STATE, JSON.stringify(state, null, 2));
  console.log(`${existing ? 'updated' : 'created'}  #${res.id}  ${spec.slug}  (${words} words${seo ? ', seo set' : ''})`);
  await new Promise((r) => setTimeout(r, 3000)); // stay under the site's rate limit
}

if (dry) console.log(`\n${specs.length} specs, nothing sent (--dry-run).`);
