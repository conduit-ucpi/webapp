#!/usr/bin/env node
/**
 * Push brands from config/brands/snapshot.json to the white-label service.
 *
 *   WHITELABEL_URL=https://api.stabledrop.me WHITELABEL_ADMIN_KEY=… node scripts/brands/push.mjs [id …]
 *
 * With no ids, pushes every brand in the snapshot. This is how the service is
 * first seeded, and how a brand edited in the snapshot gets back to the service.
 * The service validates each one and reports every problem at once.
 *
 * Uploading images and fonts is separate (POST /api/brands/{id}/assets); the
 * config then refers to them by the id the upload returns.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const base = (process.env.WHITELABEL_URL || '').replace(/\/$/, '');
const key = process.env.WHITELABEL_ADMIN_KEY;
if (!base || !key) {
  console.error('Set WHITELABEL_URL and WHITELABEL_ADMIN_KEY.');
  process.exit(2);
}

const snapshotPath = fileURLToPath(new URL('../../config/brands/snapshot.json', import.meta.url));
const { brands } = JSON.parse(readFileSync(snapshotPath, 'utf8'));
const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(brands);

let failed = 0;
for (const id of ids) {
  const entry = brands[id];
  if (!entry) {
    console.error(`✗ ${id}: not in the snapshot`);
    failed++;
    continue;
  }
  const res = await fetch(`${base}/api/brands/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': key },
    body: JSON.stringify(entry.config),
  });
  const body = await res.text();
  if (res.ok) {
    console.log(`✓ ${id} → version ${JSON.parse(body).version}`);
  } else {
    failed++;
    console.error(`✗ ${id}: HTTP ${res.status}`);
    try {
      const err = JSON.parse(body);
      console.error(`  ${err.error}`);
      (err.details || []).forEach((d) => console.error(`   - ${d}`));
    } catch {
      console.error(`  ${body.slice(0, 500)}`);
    }
  }
}
process.exit(failed ? 1 : 0);
