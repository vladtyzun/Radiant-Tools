import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = process.env.WP_SITE_ROOT || resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Load .env from wordpress-site/ (real env vars win). */
export function loadEnv() {
  const file = resolve(ROOT, '.env');
  if (existsSync(file)) {
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (!m || line.trim().startsWith('#')) continue;
      const val = m[2].replace(/^(['"])(.*)\1$/, '$2');
      if (process.env[m[1]] === undefined) process.env[m[1]] = val;
    }
  }
  const { WP_URL, WP_USER, WP_APP_PASSWORD } = process.env;
  const missing = ['WP_URL', 'WP_USER', 'WP_APP_PASSWORD'].filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(`Missing ${missing.join(', ')}. Copy .env.example to .env and fill it in.`);
  }
  return { url: WP_URL.replace(/\/+$/, ''), user: WP_USER, password: WP_APP_PASSWORD };
}
