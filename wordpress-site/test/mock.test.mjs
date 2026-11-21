import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CLI = join(ROOT, 'bin/wp-site.mjs');

function server() {
  const pages = [{ id: 7, slug: 'about', title: { raw: 'About' }, status: 'publish', modified: 'T1', content: { raw: '<p>hi</p>' } }];
  const srv = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const send = (o, h = {}) => { res.writeHead(200, { 'content-type': 'application/json', 'x-wp-totalpages': '1', ...h }); res.end(JSON.stringify(o)); };
      if (!req.headers.authorization?.startsWith('Basic ')) { res.writeHead(401); return res.end('{"message":"no auth"}'); }
      const u = req.url.split('?')[0];
      if (u === '/wp-json/') return send({ name: 'Studio', url: 'x' });
      if (u === '/wp-json/wp/v2/users/me') return send({ name: 'Admin', roles: ['administrator'] });
      if (u === '/wp-json/wp/v2/pages' && req.method === 'GET') return send(pages);
      if (u === '/wp-json/wp/v2/posts') return send([]);
      if (u === '/wp-json/wp/v2/pages/7' && req.method === 'GET') return send(pages[0]);
      if (u === '/wp-json/wp/v2/pages/7' && req.method === 'POST') {
        const p = JSON.parse(body); Object.assign(pages[0], { title: { raw: p.title }, content: { raw: p.content }, status: p.status, modified: 'T2' });
        return send({ ...pages[0], link: 'http://x/about' });
      }
      res.writeHead(404); res.end('{"message":"nope"}');
    });
  });
  return new Promise((r) => srv.listen(0, () => r(srv)));
}

test('pull, edit, push, conflict detection', async () => {
  const srv = await server();
  try {
  const tmp = mkdtempSync(join(tmpdir(), 'wp-'));
  const env = { ...process.env, WP_SITE_ROOT: tmp, WP_URL: `http://127.0.0.1:${srv.address().port}`, WP_USER: 'a', WP_APP_PASSWORD: 'b' };
  const run = (...a) => new Promise((res) => {
    import('node:child_process').then(({ execFile }) => execFile('node', [CLI, ...a], { env, cwd: ROOT }, (e, out, err) => res({ code: e?.code ?? 0, out, err, e })));
  });
  const c = await run('check'); assert.match(c.out, /Auth OK/, c.err);
  await run('pull', 'pages');
  const file = join(tmp, 'content/pages/about.html');
  assert.ok(existsSync(file));
  writeFileSync(file, readFileSync(file, 'utf8').replace('<p>hi</p>', '<p>changed</p>'));
  assert.match((await run('push', file, '--dry-run')).out, /would update/);
  assert.match((await run('push', file)).out, /updated/);
  // server now at T2, local meta rewritten to T2 -> no conflict, unchanged
  assert.match((await run('push', file)).out, /unchanged/);
  // simulate stale local copy
  writeFileSync(file, readFileSync(file, 'utf8').replace('modified: T2', 'modified: T0').replace('changed', 'again'));
  const r = await run('push', file);
  assert.match(r.out, /CONFLICT/);
  } finally { srv.closeAllConnections(); srv.close(); }
});
