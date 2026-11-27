#!/usr/bin/env node
/**
 * Refresh config/brands/snapshot.json from the white-label service.
 *
 *   WHITELABEL_URL=https://api.stabledrop.me WHITELABEL_ADMIN_KEY=… node scripts/brands/pull.mjs
 *
 * Takes every brand the service holds. Without an admin key the brand list is
 * not available, so pass the ids to take instead:
 *
 *   WHITELABEL_URL=… node scripts/brands/pull.mjs stabledrop cobro
 *
 * Run after changing a brand in the service, and commit the result. It is a
 * script rather than a build step so a build never depends on the service
 * being up — the snapshot exists precisely for when it is not.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const base = (process.env.WHITELABEL_URL || '').replace(/\/$/, '');
const key = process.env.WHITELABEL_ADMIN_KEY;
if (!base) {
  console.error('Set WHITELABEL_URL.');
  process.exit(2);
}

let ids = process.argv.slice(2);
if (!ids.length) {
  if (!key) {
    console.error('Pass brand ids, or set WHITELABEL_ADMIN_KEY to take every brand.');
    process.exit(2);
  }
  const res = await fetch(`${base}/api/brands`, { headers: { 'X-API-Key': key } });
  if (!res.ok) {
    console.error(`Listing brands failed: HTTP ${res.status}`);
    process.exit(1);
  }
  ids = (await res.json()).map((b) => b.id);
}

const snapshotPath = fileURLToPath(new URL('../../config/brands/snapshot.json', import.meta.url));
const previous = JSON.parse(readFileSync(snapshotPath, 'utf8')).brands;
const brands = {};
for (const id of ids.sort()) {
  const res = await fetch(`${base}/api/brands/${id}`);
  if (!res.ok) {
    console.error(`✗ ${id}: HTTP ${res.status} — snapshot left unchanged`);
    process.exit(1);
  }
  const { version, config } = await res.json();
  brands[id] = { version, config };
  const was = previous[id]?.version;
  console.log(`✓ ${id} v${version}${was === undefined ? ' (new)' : was === version ? '' : ` (was v${was})`}`);
}

if (!brands.stabledrop) {
  console.error('✗ The service returned no stabledrop brand — refusing to write a snapshot without the default.');
  process.exit(1);
}

writeFileSync(snapshotPath, JSON.stringify({ brands }, null, 2) + '\n');
console.log(`Wrote ${Object.keys(brands).length} brands to config/brands/snapshot.json`);
