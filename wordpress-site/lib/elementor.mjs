import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './env.mjs';

/**
 * Builds new Elementor pages by cloning section patterns out of an existing page
 * (the "Our Services" page, 7363). Cloning rather than hand-writing JSON means new
 * pages inherit the site's fonts, colour globals, spacing and widget styling.
 */

const TEMPLATE_PAGE = join(ROOT, 'research/elementor/7363.json');

/** Elementor element ids are 7-char lowercase hex. */
const newId = () => Math.random().toString(16).slice(2, 9).padEnd(7, '0');

export function loadPatterns() {
  const page = JSON.parse(readFileSync(TEMPLATE_PAGE, 'utf8'));
  const data = JSON.parse(page.meta._elementor_data);
  return {
    hero: data[0],      // H1 + lead
    intro: data[2],     // eyebrow + lead paragraph
    block: data[3],     // name / "The challenge" + para + button / "We deliver" + list
    proof: data[10],    // testimonial + counters
    cards3: data[11],   // three cards with icon, title, body
    steps3: data[12],   // three numbered steps
  };
}

/** Deep clone and give every element (and repeater row) a fresh id. */
export function clone(node) {
  const copy = JSON.parse(JSON.stringify(node));
  const reid = (el) => {
    if (el.id) el.id = newId();
    const s = el.settings || {};
    for (const v of Object.values(s)) {
      if (Array.isArray(v)) for (const row of v) if (row && typeof row === 'object' && row._id) row._id = newId();
    }
    (el.elements || []).forEach(reid);
  };
  reid(copy);
  return copy;
}

/** Walk a dotted path like "1.0.2" down the elements tree. */
function at(node, path) {
  if (path === '') return node;
  return path.split('.').reduce((n, i) => {
    if (!n?.elements?.[Number(i)]) throw new Error(`Path ${path} missing at segment ${i}`);
    return n.elements[Number(i)];
  }, node);
}

/**
 * Apply { "<path>": { key: value } } patches to a cloned pattern.
 * Special keys: `list` replaces a fancy-list's items, `href` sets a button link.
 */
export function patch(node, patches) {
  for (const [path, values] of Object.entries(patches)) {
    const el = at(node, path);
    const s = (el.settings ||= {});
    for (const [k, v] of Object.entries(values)) {
      if (k === 'list') {
        s.icon_list = v.map((text) => ({ text, _id: newId() }));
      } else if (k === 'href') {
        s.link = { ...(s.link || {}), url: v, is_external: '', nofollow: '' };
      } else if (k === 'editor') {
        s.editor = v.startsWith('<') ? v : `<p>${v}</p>`;
      } else {
        s[k] = v;
      }
    }
  }
  return node;
}

/** Build one section: { pattern, patches } -> cloned+patched Elementor container. */
export function section({ pattern, patches = {} }, patterns) {
  const p = patterns[pattern];
  if (!p) throw new Error(`Unknown pattern "${pattern}"`);
  return patch(clone(p), patches);
}

/** Readable HTML fallback written to post_content (SEO + the content/ files). */
export function toHtml(spec) {
  const out = [`<h1>${spec.h1.replace(/\n/g, '<br>')}</h1>`, `<p>${spec.lead}</p>`];
  for (const s of spec.sections || []) {
    if (s.heading) out.push(`<h2>${s.heading}</h2>`);
    if (s.body) out.push(`<p>${s.body}</p>`);
    if (s.items) out.push('<ul>' + s.items.map((i) => `<li>${i}</li>`).join('') + '</ul>');
    for (const c of s.cards || []) {
      out.push(`<h3>${c.title}</h3><p>${c.body}</p>`);
    }
  }
  return out.join('\n');
}

export const metaFor = (elementorData) => ({
  _elementor_edit_mode: 'builder',
  _elementor_template_type: 'wp-page',
  _elementor_data: JSON.stringify(elementorData),
});
