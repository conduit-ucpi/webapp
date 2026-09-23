import fs from 'fs';
import path from 'path';

/**
 * Absolute path to a source file, wherever it currently lives.
 *
 * The product tree moved into packages/whitelabel-sdk/src, so a test that reads
 * a component's source by path cannot assume the repo root any more. This
 * mirrors the resolution order the `@/` alias uses — SDK first, app second — so
 * tests keep naming files the way the code imports them.
 *
 * Falls back to the app path when neither exists, so the caller still gets a
 * useful ENOENT naming the path it expected rather than a silent skip.
 */
const APP_ROOT = process.cwd();
const SDK_ROOT = path.join(APP_ROOT, 'packages/whitelabel-sdk/src');

export function sourceFile(relativePath: string): string {
  const inSdk = path.join(SDK_ROOT, relativePath);
  return fs.existsSync(inSdk) ? inSdk : path.join(APP_ROOT, relativePath);
}
