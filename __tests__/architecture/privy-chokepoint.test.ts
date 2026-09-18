/**
 * Architecture Test: Privy is confined to its host.
 *
 * The sibling of reown-chokepoint.test.ts, applied from day one rather than after the fact.
 * `@privy-io/*` may be imported by exactly one file — the React host — and the provider class
 * that implements `UnifiedProvider` must not import it at all, because the class is meant to
 * be driven by a fake host in tests. The moment it imports Privy directly, that stops being
 * possible and nobody is told.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '../../');
const SCAN_DIRS = ['components', 'pages', 'utils', 'lib', 'hooks', 'packages/whitelabel-sdk/src'];

const HOST = 'packages/whitelabel-sdk/src/lib/auth/providers/privy/PrivyHost.tsx';
const PROVIDER_CLASS = 'packages/whitelabel-sdk/src/lib/auth/providers/PrivyProvider.ts';
const BRIDGE = 'packages/whitelabel-sdk/src/lib/auth/providers/privy/privyBridge.ts';

const PRIVY_IMPORT = /(?:import|require)\s*(?:[^'"]*from\s*)?\(?\s*['"]@privy-io\/[^'"]*['"]/;

const sourceFiles = (dir: string): string[] => {
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) return [];
  const out: string[] = [];
  const walk = (current: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const p = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (['node_modules', '.next', 'dist', 'build'].includes(entry.name)) continue;
        walk(p);
      } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.d\.ts$/.test(entry.name)) {
        out.push(path.relative(ROOT, p));
      }
    }
  };
  walk(full);
  return out;
};

describe('Privy is confined to its host', () => {
  const files = SCAN_DIRS.flatMap(sourceFiles);
  const read = (f: string) => fs.readFileSync(path.join(ROOT, f), 'utf8');

  it('scans a meaningful number of files', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('is imported by the host and nothing else', () => {
    const offenders = files.filter((f) => f !== HOST && PRIVY_IMPORT.test(read(f)));

    expect(offenders).toEqual([]);
  });

  it('the host still exists', () => {
    expect(fs.existsSync(path.join(ROOT, HOST))).toBe(true);
  });

  it('the provider class and the bridge know Privy only through the seam', () => {
    // ⚠️ THE ONE THAT KEEPS THE CLASS TESTABLE. PrivyProvider.test.ts drives the class with a
    //    fake host; that works only while the class reaches Privy solely through privyBridge.
    for (const f of [PROVIDER_CLASS, BRIDGE]) {
      expect(PRIVY_IMPORT.test(read(f))).toBe(false);
    }
    expect(read(PROVIDER_CLASS)).toMatch(/from '\.\/privy\/privyBridge'/);
  });

  it('the provider proves ownership through the auth contract', () => {
    const source = read(PROVIDER_CLASS);

    expect(source).not.toMatch(/\/api\/auth\/siwe\//);
    expect(source).toMatch(/from '@\/lib\/auth\/walletAuthClient'/);
  });
});
