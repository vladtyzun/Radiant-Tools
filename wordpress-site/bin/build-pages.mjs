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
import { loadPatterns, section, toHtml, metaFor } from '../lib/elementor.mjs';

const SPEC_DIR = join(ROOT, 'content-specs');
const STATE = join(SPEC_DIR, 'built.json');
const CTA_HREF = '/#contact';

/** Friendly spec fields -> Elementor patch paths for each cloned pattern. */
const COMPOSE = {
  hero: (s) => ({ pattern: 'hero', patches: { '0': { title: s.h1 }, '1': { title: s.lead } } }),

  intro: (s) => ({ pattern: 'intro', patches: { '0': { title: s.eyebrow }, '1': { editor: s.body } } }),

  block: (s) => ({
    pattern: 'block',
    patches: {
      '0': { editor: s.label },
      '1.0.0': { title: s.challengeTitle || 'The challenge' },
      '1.0.1': { editor: s.challenge },
      '1.0.2': { text: s.cta?.text || 'Book a call', href: s.cta?.href || CTA_HREF },
      '1.1.0': { title: s.deliverTitle || 'We deliver' },
      '1.1.1': { list: s.items || [] },
    },
  }),

  cards3: (s) => ({
    pattern: 'cards3',
    patches: {
      '0': { title: s.heading },
      ...Object.fromEntries(s.cards.flatMap((c, i) => [
        [`1.${i}.0.1.0`, { editor: c.title }],
        [`1.${i}.0.1.1`, { editor: c.body }],
      ])),
    },
  }),

  steps3: (s) => ({
    pattern: 'steps3',
    patches: {
      '0': { title: s.heading },
      ...Object.fromEntries(s.steps.flatMap((st, i) => [
        [`1.${i}.0.0`, { editor: st.label }],
        [`1.${i}.0.1.0`, { editor: st.title }],
        [`1.${i}.0.1.1`, { editor: st.body }],
      ])),
    },
  }),

  proof: (s) => ({
    pattern: 'proof',
    patches: {
      '0': { title: s.heading },
      '1.0.0.1.0': { editor: s.name },
      '1.0.0.1.1': { editor: s.role },
      '1.0.2': { editor: s.quote },
    },
  }),
};

function buildElementor(spec, patterns) {
  return spec.sections.map((s) => {
    const compose = COMPOSE[s.p];
    if (!compose) throw new Error(`${spec.slug}: unknown section type "${s.p}"`);
    return section(compose(s), patterns);
  });
}

/** Flatten a spec into readable HTML for post_content (SEO fallback + content/ files). */
function specToHtml(spec) {
  const out = [];
  for (const s of spec.sections) {
    if (s.p === 'hero') out.push(`<h1>${s.h1}</h1>`, `<p>${s.lead}</p>`);
    if (s.p === 'intro') out.push(`<h2>${s.eyebrow}</h2>`, `<p>${s.body}</p>`);
    if (s.p === 'block') {
      out.push(`<h2>${s.label}</h2>`, `<h3>${s.challengeTitle || 'The challenge'}</h3>`, `<p>${s.challenge}</p>`);
      out.push(`<h3>${s.deliverTitle || 'We deliver'}</h3><ul>${(s.items || []).map((i) => `<li>${i}</li>`).join('')}</ul>`);
    }
    if (s.p === 'cards3') out.push(`<h2>${s.heading}</h2>`, ...s.cards.map((c) => `<h3>${c.title}</h3><p>${c.body}</p>`));
    if (s.p === 'steps3') out.push(`<h2>${s.heading}</h2>`, ...s.steps.map((c) => `<h3>${c.title}</h3><p>${c.body}</p>`));
    if (s.p === 'proof') out.push(`<h2>${s.heading}</h2>`, `<blockquote><p>${s.quote}</p><cite>${s.name}, ${s.role}</cite></blockquote>`);
  }
  return out.join('\n');
}

const args = process.argv.slice(2);
const dry = args.includes('--dry-run');
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
  const data = buildElementor(spec, patterns);
  const words = specToHtml(spec).replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  if (dry) {
    console.log(`${spec.slug.padEnd(34)} ${String(spec.sections.length).padStart(2)} sections  ${String(words).padStart(4)} words  parent=${spec.parentKey || '-'}`);
    continue;
  }
  const payload = {
    title: spec.title,
    slug: spec.slug,
    status: 'draft',
    content: specToHtml(spec),
    meta: metaFor(data),
  };
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
  console.log(`${existing ? 'updated' : 'created'}  #${res.id}  ${spec.slug}  (${words} words)`);
  await new Promise((r) => setTimeout(r, 3000)); // stay under the site's rate limit
}

if (dry) console.log(`\n${specs.length} specs, nothing sent (--dry-run).`);
