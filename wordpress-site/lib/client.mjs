import { readFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';

const MIME = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.avif': 'image/avif',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.pdf': 'application/pdf',
};

/** Minimal WordPress REST client (Basic auth with an Application Password). */
export class WP {
  constructor({ url, user, password }) {
    this.base = `${url}/wp-json/wp/v2`;
    this.root = `${url}/wp-json`;
    this.auth = 'Basic ' + Buffer.from(`${user}:${password}`).toString('base64');
  }

  async request(path, { method = 'GET', body, headers = {}, root = false } = {}) {
    const res = await fetch((root ? this.root : this.base) + path, {
      method,
      headers: { Authorization: this.auth, Accept: 'application/json', ...headers },
      body,
    });
    const text = await res.text();
    let data;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) {
      const msg = data?.message || res.statusText;
      throw new Error(`${method} ${path} -> ${res.status}: ${msg}`);
    }
    return { data, headers: res.headers };
  }

  json(path, method, payload) {
    return this.request(path, {
      method,
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    }).then((r) => r.data);
  }

  get(path) { return this.request(path).then((r) => r.data); }

  /** Fetch every item of a collection (handles pagination). */
  async all(path, params = {}) {
    const items = [];
    for (let page = 1; ; page++) {
      const qs = new URLSearchParams({ per_page: '100', page: String(page), context: 'edit', ...params });
      const { data, headers } = await this.request(`${path}?${qs}`);
      items.push(...data);
      if (page >= Number(headers.get('x-wp-totalpages') || 1)) break;
    }
    return items;
  }

  me() { return this.get('/users/me?context=edit'); }

  async upload(file) {
    const buf = await readFile(file);
    const name = basename(file);
    const type = MIME[extname(name).toLowerCase()] || 'application/octet-stream';
    return this.request('/media', {
      method: 'POST',
      body: buf,
      headers: {
        'Content-Type': type,
        'Content-Disposition': `attachment; filename="${name}"`,
      },
    }).then((r) => r.data);
  }
}
