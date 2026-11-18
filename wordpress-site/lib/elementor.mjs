import { loadPatterns, at } from './patterns.mjs';
export { loadPatterns };

/** Elementor element ids are 7-char lowercase hex. */
const newId = () => Math.random().toString(16).slice(2, 9).padEnd(7, '0');

/** Deep clone, giving every element and repeater row a fresh id. */
export function clone(node) {
  const copy = JSON.parse(JSON.stringify(node));
  (function reid(el) {
    if (el.id) el.id = newId();
    for (const v of Object.values(el.settings || {})) {
      if (Array.isArray(v)) for (const row of v) if (row && typeof row === 'object' && row._id) row._id = newId();
    }
    (el.elements || []).forEach(reid);
  })(copy);
  return copy;
}

/** Set one value on an element, by the property kind named after `#` in a slot. */
function setProp(el, prop, value) {
  const s = (el.settings ||= {});
  switch (prop) {
    case 'editor':
      s.editor = String(value).startsWith('<') ? value : `<p>${value}</p>`;
      break;
    case 'title': case 'text':
      s[prop] = value;
      break;
    case 'href':
      s.link = { ...(s.link || {}), url: value, is_external: '', nofollow: '' };
      break;
    case 'list':
      // bdt-fancy-list and icon-list both read `icon_list`; keep each row's styling keys.
      s.icon_list = value.map((text, i) => ({ ...(s.icon_list?.[i] || {}), text, _id: newId() }));
      break;
    case 'icon':
      s.selected_icon = { value, library: String(value).startsWith('lu ') ? 'uicore-lucide-icons' : 'fa-solid' };
      break;
    default:
      s[prop] = value;
  }
}

/** Apply { name: "path#prop" } slots using values from `data`. Missing values are skipped. */
function applySlots(node, slots, data) {
  for (const [name, spec] of Object.entries(slots || {})) {
    if (data[name] === undefined || data[name] === null) continue;
    const [path, prop] = spec.split('#');
    setProp(at(node, path), prop, data[name]);
  }
}

/**
 * Resize a repeating group to match the rows given, then patch each row.
 * Extra sibling cells are removed; if more rows are supplied than the pattern
 * ships with, the last cell is cloned to make up the difference.
 */
function applyRepeat(node, repeat, rows) {
  const base = at(node, repeat.base);
  const cells = base.elements || [];
  if (!cells.length) throw new Error(`repeat base "${repeat.base}" has no cells`);
  const wanted = rows.length;
  if (repeat.fromCell !== undefined) {
    // Sibling cells in the source template differ (e.g. a "featured" plan card has
    // an extra wrapper and a badge). Build every row from one reference cell so the
    // slot paths hold and the cards come out uniform.
    const ref = cells[repeat.fromCell];
    if (!ref) throw new Error(`repeat fromCell ${repeat.fromCell} missing`);
    base.elements = Array.from({ length: wanted }, () => clone(ref));
    rows.forEach((row, i) => {
      for (const path of repeat.rowTrim || []) {
        const idx = path.lastIndexOf('.');
        const parent = idx < 0 ? base.elements[i] : at(base.elements[i], path.slice(0, idx));
        const child = Number(idx < 0 ? path : path.slice(idx + 1));
        if (parent?.elements?.[child]) parent.elements.splice(child, 1);
      }
      applySlots(base.elements[i], repeat.slots, row);
    });
    return;
  }
  while (cells.length < wanted) cells.push(clone(cells[cells.length - 1]));
  cells.length = wanted;
  rows.forEach((row, i) => {
    // Drop sub-elements the source template carried that this page has no content
    // for (e.g. the demo screenshot strip inside a chip card).
    for (const path of repeat.rowTrim || []) {
      const idx = path.lastIndexOf('.');
      const parent = idx < 0 ? cells[i] : at(cells[i], path.slice(0, idx));
      const child = Number(idx < 0 ? path : path.slice(idx + 1));
      if (parent?.elements?.[child]) parent.elements.splice(child, 1);
    }
    applySlots(cells[i], repeat.slots, row);
  });
}

/** Build one section from a spec entry: { p: '<pattern>', ...values, rows: [...] }. */
export function section(entry, patterns) {
  const pattern = patterns[entry.p];
  if (!pattern) throw new Error(`unknown pattern "${entry.p}"`);
  const node = clone(pattern.node);
  applySlots(node, pattern.slots, entry);
  if (pattern.repeat) {
    const rows = entry.rows || [];
    if (!rows.length) throw new Error(`pattern "${entry.p}" needs rows`);
    applyRepeat(node, pattern.repeat, rows);
  }
  return node;
}

export const metaFor = (elementorData) => ({
  _elementor_edit_mode: 'builder',
  _elementor_template_type: 'wp-page',
  _elementor_data: JSON.stringify(elementorData),
});
