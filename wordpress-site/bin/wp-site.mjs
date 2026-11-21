#!/usr/bin/env node
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadEnv, ROOT } from '../lib/env.mjs';
import { WP } from '../lib/client.mjs';
import { TYPES, writeItem, readItem, listFiles, typeOfFile, fileFor } from '../lib/content.mjs';

const HELP = `wp-site — manage the Radiant WordPress site

Usage: npm run wp -- <command> [options]

  check                         Verify credentials and print site/user info
  list <pages|posts|media|plugins|themes>
  pull [pages|posts|all]        Download content to content/ (default: all)
  push <file...> [--dry-run] [--force]
                                Update (or create, if no id) from content files
  push --all [--dry-run] [--force]
  media <file...>               Upload images/files to the media library
  backup                        Full JSON export to backups/<timestamp>/

Edits are local files under content/. 'push' refuses to overwrite a page that
changed on the server since your last pull unless you pass --force.`;

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const pos = args.filter((a) => !a.startsWith('--'));
const [cmd, ...rest] = pos;

const log = (...a) => console.log(...a);

async function main() {
  if (!cmd || cmd === 'help' || flags.has('--help')) return log(HELP);
  const wp = new WP(loadEnv());

  switch (cmd) {
    case 'check': {
      const me = await wp.me();
      const root = await wp.request('/', { root: true }).then((r) => r.data);
      log(`Site:  ${root.name} (${root.url})`);
      log(`User:  ${me.name} [${(me.roles || []).join(', ')}]`);
      log('Auth OK');
      return;
    }
    case 'list': {
      const what = rest[0];
      if (what === 'plugins' || what === 'themes') {
        const items = await wp.all(`/${what}`, { context: 'view' }).catch(() => wp.get(`/${what}`));
        for (const i of items) log(`${(i.status || '').padEnd(9)} ${i.plugin || i.stylesheet}  v${i.version}`);
      } else if (['pages', 'posts', 'media'].includes(what)) {
        for (const i of await wp.all(`/${what}`)) {
          log(`${String(i.id).padEnd(6)} ${(i.status || '').padEnd(8)} ${i.slug.padEnd(30)} ${i.title?.raw ?? i.title?.rendered ?? ''}`);
        }
      } else throw new Error('list needs: pages | posts | media | plugins | themes');
      return;
    }
    case 'pull': {
      const which = rest[0] && rest[0] !== 'all' ? [rest[0]] : Object.keys(TYPES);
      for (const type of which) {
        if (!TYPES[type]) throw new Error(`Unknown type ${type}`);
        const items = await wp.all(`/${type}`, { status: 'publish,draft,pending,private,future' });
        for (const item of items) writeItem(type, item);
        log(`pulled ${items.length} ${type}`);
      }
      return;
    }
    case 'push': {
      const dry = flags.has('--dry-run');
      const files = flags.has('--all')
        ? Object.keys(TYPES).flatMap(listFiles)
        : rest.map((f) => resolve(f));
      if (!files.length) throw new Error('Nothing to push. Pass files or --all.');
      for (const file of files) {
        const type = typeOfFile(file);
        const { meta, body } = readItem(file);
        const payload = { title: meta.title, slug: meta.slug, status: meta.status || 'draft', content: body };
        if (meta.parent) payload.parent = Number(meta.parent);
        if (meta.id) {
          const remote = await wp.get(`/${type}/${meta.id}?context=edit`);
          const changed = remote.modified !== meta.modified;
          const same = (remote.content?.raw ?? '') === body && remote.title?.raw === meta.title
            && remote.slug === meta.slug && remote.status === payload.status;
          if (same) { log(`= unchanged  ${meta.slug}`); continue; }
          if (changed && !flags.has('--force')) {
            log(`! CONFLICT   ${meta.slug}: edited on server since last pull. Pull, merge, or use --force.`);
            process.exitCode = 1;
            continue;
          }
          if (dry) { log(`~ would update ${type}/${meta.slug} (#${meta.id})`); continue; }
          const res = await wp.json(`/${type}/${meta.id}`, 'POST', payload);
          writeItem(type, { ...res, content: { raw: body } });
          log(`~ updated    ${type}/${meta.slug} -> ${res.link}`);
        } else {
          if (dry) { log(`+ would create ${type}/${meta.slug}`); continue; }
          const res = await wp.json(`/${type}`, 'POST', payload);
          writeItem(type, { ...res, content: { raw: body } });
          log(`+ created    ${type}/${meta.slug} (#${res.id}) -> ${res.link}`);
        }
      }
      return;
    }
    case 'media': {
      if (!rest.length) throw new Error('Pass one or more files');
      for (const f of rest) {
        const m = await wp.upload(resolve(f));
        log(`uploaded #${m.id}  ${m.source_url}`);
      }
      return;
    }
    case 'backup': {
      const dir = join(ROOT, 'backups', new Date().toISOString().replace(/[:.]/g, '-'));
      mkdirSync(dir, { recursive: true });
      for (const type of ['pages', 'posts', 'media', 'categories', 'tags', 'users', 'comments']) {
        try {
          const items = await wp.all(`/${type}`, type === 'pages' || type === 'posts' ? { status: 'any' } : {});
          writeFileSync(join(dir, `${type}.json`), JSON.stringify(items, null, 2));
          log(`${type}: ${items.length}`);
        } catch (e) { log(`${type}: skipped (${e.message})`); }
      }
      log(`Backup written to ${dir}\nNote: this is content only — use host/plugin backups for files + database.`);
      return;
    }
    default:
      throw new Error(`Unknown command "${cmd}". Run with --help.`);
  }
}

main().catch((e) => { console.error(`Error: ${e.message}`); process.exit(1); });
