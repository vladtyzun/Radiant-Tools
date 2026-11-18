import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './env.mjs';

/**
 * Pattern library harvested from real, designed sections already on the site.
 *
 * Earlier versions of this builder only cloned six patterns off the Our Services
 * page, which produced pages that were six variations of one stacked text layout.
 * These sources add the designed card grids, plan cards and chip cards that live in
 * the Elementor library templates, so generated pages have the same visual
 * vocabulary as the rest of the site (bordered cards, radii, global colour tokens).
 *
 * `at` paths are relative to each pattern's root container.
 */

const SRC = {
  page7363: () => JSON.parse(readFileSync(join(ROOT, 'research/elementor/7363.json'), 'utf8')),
  page7630: () => JSON.parse(readFileSync(join(ROOT, 'research/elementor/7630.json'), 'utf8')),
  library: () => JSON.parse(readFileSync(join(ROOT, 'research/elementor/_elementor_library.json'), 'utf8')),
};

const dataOf = (item) => JSON.parse(item.meta._elementor_data);
const byId = (items, id) => items.find((i) => i.id === id);

/** Walk a dotted path down `elements`. */
export function at(node, path) {
  if (path === '') return node;
  return path.split('.').reduce((n, i) => {
    const next = n?.elements?.[Number(i)];
    if (!next) throw new Error(`pattern path "${path}" missing at segment ${i}`);
    return next;
  }, node);
}

export function loadPatterns() {
  const page = dataOf(SRC.page7363());
  const lib = SRC.library();
  const t7450 = dataOf(byId(lib, 7450))[0];   // "Because Your Business Matters" — 6-card icon grid
  const t7456 = dataOf(byId(lib, 7456))[0];   // "Services we provide" — chip cards
  const t945 = dataOf(byId(lib, 945));        // "Subscription" — plans, logos, reviews, steps
  const work7630 = dataOf(SRC.page7630())[0]; // Work page — live portfolio grid

  return {
    // --- from the Our Services page -------------------------------------------
    hero:   { node: page[0],  slots: { h1: '0#title', lead: '1#title' } },
    intro:  { node: page[2],  slots: { eyebrow: '0#title', body: '1#editor' } },
    block:  { node: page[3],  slots: {
      label: '0#editor', challengeTitle: '1.0.0#title', challenge: '1.0.1#editor',
      ctaText: '1.0.2#text', ctaHref: '1.0.2#href', deliverTitle: '1.1.0#title', items: '1.1.1#list',
    } },
    proof:  { node: page[10], slots: { heading: '0#title', name: '1.0.0.1.0#editor', role: '1.0.0.1.1#editor', quote: '1.0.2#editor' } },
    cards3: { node: page[11], slots: { heading: '0#title' }, repeat: {
      base: '1', count: 3, slots: { title: '0.1.0#editor', body: '0.1.1#editor' },
    } },
    steps3: { node: page[12], slots: { heading: '0#title' }, repeat: {
      base: '1', count: 3, slots: { label: '0.0#editor', title: '0.1.0#editor', body: '0.1.1#editor' },
    } },

    // --- designed sections from the Elementor library --------------------------
    /** 6 bordered cards, each with a Lucide icon, title and body. */
    grid6:  { node: t7450, slots: { heading: '0.0.0#title', lead: '0.0.1#editor' }, repeat: {
      base: '0.0.2', count: 6, slots: { icon: '0.0#icon', title: '0.1.0#editor', body: '0.1.1#editor' },
    } },
    /** Cards with a title, description and a row of up to 4 chips. */
    chipCards: { node: t7456, slots: {}, repeat: {
      base: '0.2', count: 7, slots: {
        title: '0.0#editor', body: '0.1#editor',
        chip0: '0.2.0#editor', chip1: '0.2.1#editor', chip2: '0.2.2#editor', chip3: '0.2.3#editor',
      },
      // the library card ends with a strip of UiCore demo screenshots
      rowTrim: ['0.3'],
    } },
    /** Three plan cards: name, price, unit, feature list, two buttons. */
    plans:  { node: t945[12], slots: { heading: '0.0#title' }, repeat: {
      base: '0.1', count: 3, fromCell: 0, slots: {
        name: '0.0#editor', price: '0.1.0#editor', unit: '0.1.1#editor',
        items: '1#list', ctaText: '2#text', ctaHref: '2#href',
      },
    } },
    /** Numbered step cards with an image per step. */
    steps:  { node: t945[4], slots: {}, repeat: {
      base: '0', count: 3, slots: { label: '0#editor', body: '1#editor' },
    } },
    logos:   { node: t945[2],  slots: {} },
    reviews: { node: t945[11], slots: { heading: '0#title', lead: '1#editor' } },
    /**
     * The live portfolio grid from the Work page. Preferred over the library's
     * "latest work" block, which ships hard-coded demo images and a filter menu.
     */
    work:    { node: work7630, slots: { heading: '0#title' } },
  };
}
