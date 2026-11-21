import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ROOT } from './env.mjs';

export const TYPES = { pages: 'pages', posts: 'posts' };
export const CONTENT_DIR = join(ROOT, 'content');

/**
 * Content files look like:
 *   ---
 *   id: 42
 *   title: About
 *   slug: about
 *   status: publish
 *   modified: 2025-01-01T10:00:00
 *   ---
 *   <!-- wp:paragraph --> ... (raw post content, block markup preserved)
 */
export function serialize(meta, body) {
  const head = Object.entries(meta)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}: ${String(v).replace(/\r?\n/g, ' ')}`)
    .join('\n');
  return `---\n${head}\n---\n${body}\n`;
}

export function parse(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) throw new Error('Missing --- frontmatter block');
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { meta, body: m[2].replace(/\n$/, '') };
}

export function fileFor(type, slug) {
  return join(CONTENT_DIR, type, `${slug}.html`);
}

export function writeItem(type, item) {
  mkdirSync(join(CONTENT_DIR, type), { recursive: true });
  const file = fileFor(type, item.slug || `id-${item.id}`);
  writeFileSync(file, serialize({
    id: item.id,
    title: item.title?.raw ?? item.title?.rendered,
    slug: item.slug,
    status: item.status,
    parent: item.parent || undefined,
    modified: item.modified,
  }, item.content?.raw ?? ''));
  return file;
}

export function readItem(file) {
  return parse(readFileSync(file, 'utf8'));
}

export function listFiles(type) {
  const dir = join(CONTENT_DIR, type);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.html')).map((f) => join(dir, f));
}

export function typeOfFile(file) {
  const rel = relative(CONTENT_DIR, file).split(/[\\/]/)[0];
  if (!TYPES[rel]) throw new Error(`${file} must live under content/pages or content/posts`);
  return rel;
}
