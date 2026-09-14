/**
 * Architecture Test: secret credentials never reach the browser.
 *
 * There are two ways a server secret ends up client-side in this app, and both
 * have happened or nearly happened:
 *
 *   1. Reading it in code that ships. Anything under packages/whitelabel-sdk,
 *      components/ or pages/ (except pages/api) is bundled and sent to the
 *      browser. `process.env.SOMETHING_SECRET` there is inlined at build time
 *      by Next, so the value lands in a .js file anyone can read.
 *
 *   2. Putting it in /api/config. That endpoint is public and unauthenticated —
 *      its whole job is handing the client its configuration. NEYNAR_API_KEY is
 *      in there right now and readable live; it got there because a generic
 *      `*_API_KEY` name did not signal which kind of key it was.
 *
 * MoonPay makes the distinction sharp, which is why this exists now:
 * MOONPAY_API_KEY is the publishable key and belongs in the config blob, while
 * MOONPAY_API_SECRET_KEY signs widget URLs and must never leave the box. The
 * two differ by one word in the name and by pk_/sk_ in the value.
 *
 * A comment saying "server only" is not enforcement. This is.
 */

import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../..');

/** Directories whose contents are compiled into the browser bundle. */
const CLIENT_DIRS = [
  'packages/whitelabel-sdk/src',
  'components',
  'config',
  'hooks',
  'utils',
  'lib',
];

/**
 * Server-only islands inside those trees. pages/api IS the Node API, and
 * lib/server is server-only by convention (see api-fetch-chokepoint).
 */
const SERVER_ONLY = [
  `${path.sep}lib${path.sep}server${path.sep}`,
  `${path.sep}pages${path.sep}api${path.sep}`,
];

/** Server-only by naming convention, the same one api-fetch-chokepoint uses. */
const isServerByName = (file: string) => /Server\.tsx?$/.test(file);

/**
 * Env var names that must never be read in client code.
 *
 * Matched on the NAME rather than a list, so a new secret is covered the day it
 * is added instead of the day someone remembers to update this file.
 */
const SECRET_NAME = /(SECRET|PRIVATE_KEY|PASSWORD|_TOKEN$|MNEMONIC|SEED_PHRASE)/;

/**
 * Secrets whose names do not look like secrets.
 *
 * NEYNAR_API_KEY is a billed server credential called `*_API_KEY`, which is
 * indistinguishable by name from MOONPAY_API_KEY — a publishable key that
 * BELONGS in the public config. The naming rule above cannot separate them, and
 * that ambiguity is precisely how the Neynar key came to be served to every
 * visitor. So the ones we know about are named here.
 *
 * Add to this list when a credential arrives whose name does not announce
 * itself. The cost of a wrong omission is a published credential.
 */
const KNOWN_SECRETS = ['NEYNAR_API_KEY', 'X_API_KEY'];

const isSecret = (name: string) => SECRET_NAME.test(name) || KNOWN_SECRETS.includes(name);

/**
 * `process.env.FOO` and `process.env['FOO']`, capturing any `!!` in front.
 *
 * The coercion matters: `hasNeynarSearch: !!process.env.NEYNAR_API_KEY` tells
 * the client a capability exists and publishes nothing, which is exactly how a
 * secret SHOULD be used here. `neynarApiKey: process.env.NEYNAR_API_KEY`
 * publishes the credential. Only the second is a leak.
 */
const ENV_READ = /(!!\s*)?process\.env(?:\.([A-Z0-9_]+)|\[\s*['"]([A-Z0-9_]+)['"]\s*\])/g;

function walk(dir: string, out: string[] = []): string[] {
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) return out;
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      walk(rel, out);
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(rel);
    }
  }
  return out;
}

const clientFiles = CLIENT_DIRS.flatMap((d) => walk(d)).filter(
  (f) => !SERVER_ONLY.some((s) => path.join(ROOT, f).includes(s)) && !isServerByName(f)
);

describe('secrets stay server-side', () => {
  // The scan is only meaningful if it actually looked at something. A refactor
  // that moves these directories would otherwise leave this passing vacuously,
  // which has already happened once in this repo to two other architecture
  // tests after the SDK move.
  it('has client source to scan', () => {
    expect(clientFiles.length).toBeGreaterThan(100);
  });

  it('never reads a secret-shaped env var in code that ships to the browser', () => {
    const offences: string[] = [];

    for (const file of clientFiles) {
      const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
      for (const match of Array.from(src.matchAll(ENV_READ))) {
        const [, coerced, dotName, bracketName] = match;
        const name = dotName ?? bracketName;
        // Even a presence check does not belong in bundled code — the value is
        // inlined at build time whether or not it is then coerced.
        if (name && isSecret(name)) {
          offences.push(`${file}: ${coerced ? '!!' : ''}process.env.${name}`);
        }
      }
    }

    expect(offences).toEqual([]);
  });

  it('never exposes a secret-shaped env var through the public config endpoint', () => {
    // /api/config is unauthenticated and its response is handed to every
    // visitor. Anything read here is effectively published.
    const src = fs.readFileSync(path.join(ROOT, 'pages/api/config.ts'), 'utf8');

    const exposed: string[] = [];
    for (const match of Array.from(src.matchAll(ENV_READ))) {
      const [, coerced, dotName, bracketName] = match;
      const name = dotName ?? bracketName;
      // A `!!` read publishes a boolean capability flag, not the credential.
      if (name && isSecret(name) && !coerced) exposed.push(name);
    }

    expect(exposed).toEqual([]);
  });

  describe('MoonPay specifically', () => {
    const signPath = 'pages/api/moonpay/sign.ts';

    it('reads the signing key in exactly one place, and that place is the API', () => {
      const readers = [...CLIENT_DIRS, 'pages']
        .flatMap((d) => walk(d))
        .filter((f) => {
          const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
          return /process\.env\.MOONPAY_API_SECRET_KEY/.test(src);
        });

      expect(readers).toEqual([signPath]);
    });

    it('does not prefix the signing key NEXT_PUBLIC_, which would inline it', () => {
      // NEXT_PUBLIC_ is the one prefix that deliberately ships an env var to the
      // browser. On a secret it is a silent, total leak.
      const everywhere = [...CLIENT_DIRS, 'pages']
        .flatMap((d) => walk(d))
        .map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8'))
        .join('\n');

      expect(everywhere).not.toMatch(/NEXT_PUBLIC_MOONPAY/);
    });

    it('uses the signing key only as an HMAC key, never as a value', () => {
      // Structural rather than textual: every mention of the secret should be
      // reading it from the environment, testing whether it exists, or handing
      // it to createHmac. Anything else — putting it in a response, a URL, a
      // log line — is a leak. sign.test.ts asserts the same property on real
      // output; this one catches it at the shape level, where a refactor that
      // moves the response around cannot quietly disarm it.
      const src = fs.readFileSync(path.join(ROOT, signPath), 'utf8');

      const allowed = [
        /const secretKey = process\.env\.MOONPAY_API_SECRET_KEY;/,
        /!secretKey/,           // presence checks and the preview flag
        /createHmac\('sha256', secretKey as string\)/,
      ];

      const mentions = src
        .split('\n')
        .map((line, i) => ({ line: line.trim(), n: i + 1 }))
        .filter(({ line }) => /\bsecretKey\b/.test(line) && !line.startsWith('*') && !line.startsWith('//'))
        .filter(({ line }) => !allowed.some((ok) => ok.test(line)));

      expect(mentions).toEqual([]);
    });
  });
});
