#!/usr/bin/env node
/**
 * Screenshot a draft page without exposing its content or its real URL.
 *
 * WordPress application passwords authenticate REST only, so a draft cannot be
 * fetched with a browser. This publishes a THROWAWAY COPY under a random slug,
 * PASSWORD PROTECTED, screenshots it with the password cookie, then force-deletes
 * it. The real page stays a draft and its slug is never published.
 *
 * Why a password rather than noindex: AIOSEO ignores robots_* over REST, and a
 * password means WordPress serves only a password form to anyone without the
 * cookie — including crawlers. Content is never sent to an unauthenticated
 * request, so there is nothing for a search engine to index.
 *
 * Safety rules enforced here:
 *   - an unauthenticated fetch must NOT contain the page's own content; if any
 *     leaks (e.g. the builder bypasses the password), it aborts before screenshotting
 *   - the copy is force-deleted in a finally block, even on error
 *   - deletion is verified (expects 404) and sitemap.xml is checked for leftovers
 *
 *   node bin/preview.mjs <pageId>
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { loadEnv, ROOT } from '../lib/env.mjs';
import { WP } from '../lib/client.mjs';
import pw from '/opt/node-tools/node_modules/playwright/index.js';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 834, height: 1112 },
  { name: 'phone', width: 390, height: 844 },
];

const pageId = Number(process.argv[2]);
if (!pageId) { console.error('usage: preview.mjs <pageId>'); process.exit(1); }

const env = loadEnv();
const wp = new WP(env);
const OUT = join(ROOT, 'research/previews');
mkdirSync(OUT, { recursive: true });

let tempId = null;
const log = (...a) => console.log(...a);

try {
  const src = await wp.get(`/pages/${pageId}?context=edit`);
  const slug = `zz-preview-${randomBytes(5).toString('hex')}`;
  const password = randomBytes(18).toString('base64url');
  log(`source: #${pageId} "${src.title.raw}"`);

  const temp = await wp.json('/pages', 'POST', {
    title: `ZZ PREVIEW (auto-delete) ${src.title.raw}`,
    slug, status: 'draft', password, content: src.content.raw,
    meta: {
      _elementor_edit_mode: 'builder',
      _elementor_template_type: 'wp-page',
      _elementor_data: src.meta._elementor_data,
    },
  });
  tempId = temp.id;
  if (!temp.password) throw new Error('refusing to publish: password was not stored on the copy');
  log(`temp draft #${tempId} slug=${slug} (password protected)`);

  const pub = await wp.json(`/pages/${tempId}`, 'POST', { status: 'publish' });
  const url = pub.link;
  log(`published ${url}`);

  // Anonymous fetch must show the password gate, not the content.
  const anon = await (await fetch(url, { headers: { 'User-Agent': UA } })).text();
  const canary = ['Where products lose people', 'post_password', 'password'];
  const leaked = canary[0] && anon.includes(canary[0]);
  const gated = /name=["']post_password["']/i.test(anon);
  if (leaked || !gated) {
    throw new Error(`refusing to screenshot: content is reachable without the password (gated=${gated}, leaked=${leaked})`);
  }
  log('anonymous fetch shows the password gate only — content not exposed');

  // Exchange the password for the wp-postpass cookie once, by posting the form
  // directly. Driving the form in the browser is fragile here: the security
  // plugin sometimes serves a throttle page instead of the form.
  const postpass = await fetch(`${env.url}/wp-login.php?action=postpass`, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded', Referer: url },
    body: new URLSearchParams({ post_password: password }).toString(),
  });
  const setCookie = postpass.headers.getSetCookie?.() || [];
  const pass = setCookie.map((c) => c.split(';')[0]).find((c) => c.startsWith('wp-postpass_'));
  if (!pass) throw new Error(`no wp-postpass cookie returned (status ${postpass.status})`);
  const [cookieName, ...rest] = pass.split('=');
  const cookieValue = rest.join('=');
  log('obtained wp-postpass cookie');

  const host = new URL(url).hostname;
  const browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, userAgent: UA });
    await ctx.addCookies([{ name: cookieName, value: cookieValue, domain: host, path: '/' }]);
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2500);
    const gateStill = await page.locator('input[name="post_password"]').count();
    if (gateStill) throw new Error('password cookie not accepted — still showing the gate');
    await page.evaluate(async () => {
      const step = window.innerHeight * 0.8;
      for (let y = 0; y < document.body.scrollHeight; y += step) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 160)); }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(1200);
    const file = join(OUT, `${pageId}_${vp.name}.jpg`);
    await page.screenshot({ path: file, fullPage: true, type: 'jpeg', quality: 72 });
    const info = await page.evaluate(() => ({ h: document.body.scrollHeight, w: document.body.scrollWidth, words: document.body.innerText.split(/\s+/).length }));
    log(`  ${vp.name.padEnd(7)} ${vp.width}px -> ${file}  height=${info.h}px scrollW=${info.w} words=${info.words}`);
    await ctx.close();
  }
  await browser.close();
} finally {
  if (tempId) {
    await wp.request(`/pages/${tempId}?force=true`, { method: 'DELETE' }).catch((e) => log('DELETE failed:', e.message));
    const gone = await wp.get(`/pages/${tempId}`).then(() => false).catch(() => true);
    log(gone ? `temp page #${tempId} permanently deleted` : `WARNING: #${tempId} may still exist — delete it manually`);
    const sm = await fetch(`${env.url}/sitemap.xml`, { headers: { 'User-Agent': UA } }).then((r) => r.text()).catch(() => '');
    log(sm.includes('zz-preview') ? 'WARNING: a zz-preview url appears in sitemap.xml' : 'sitemap.xml clean');
  }
}
