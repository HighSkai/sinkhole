#!/usr/bin/env node
/**
 * Report the JS cost of the default route (shell + Pipeline + mock data source),
 * gzip and brotli, from Vite's build manifest. Fails if over budget.
 *
 *   npm run build && npm run size
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync, brotliCompressSync, constants } from 'node:zlib';

const BUDGET_KB = 120;
const dist = 'dist';
const manifest = JSON.parse(readFileSync(join(dist, '.vite/manifest.json'), 'utf8'));

const entryKey = Object.keys(manifest).find((k) => manifest[k].isEntry);
const byName = (needle) => Object.keys(manifest).find((k) => k.includes(needle));

function closure(key, seen = new Set()) {
  if (!key || seen.has(key)) return seen;
  seen.add(key);
  for (const dep of manifest[key].imports ?? []) closure(dep, seen);
  return seen;
}

const sets = {
  'shell (first paint)': closure(entryKey),
  'default route (shell + pipeline + mock)': [entryKey, byName('PipelinePage.svelte'), byName('data/mock.ts')].reduce(
    (s, k) => closure(k, s),
    new Set()
  )
};

const size = (key) => {
  const buf = readFileSync(join(dist, manifest[key].file));
  return {
    raw: buf.length,
    gz: gzipSync(buf, { level: 9 }).length,
    br: brotliCompressSync(buf, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length
  };
};

const kb = (n) => (n / 1024).toFixed(1).padStart(6) + ' KB';
let failed = false;
for (const [label, keys] of Object.entries(sets)) {
  const t = { raw: 0, gz: 0, br: 0 };
  for (const k of keys) {
    const s = size(k);
    t.raw += s.raw;
    t.gz += s.gz;
    t.br += s.br;
  }
  const ok = t.gz / 1024 <= BUDGET_KB;
  if (!ok && label.startsWith('default')) failed = true;
  console.log(`${label.padEnd(42)} ${keys.size} chunks  raw ${kb(t.raw)}  gzip ${kb(t.gz)}  brotli ${kb(t.br)}  ${ok ? '✓' : '✗'} (budget ${BUDGET_KB} KB gz)`);
}
process.exit(failed ? 1 : 0);
