/**
 * Architecture Test: Reown/AppKit is confined to its adapters.
 *
 * The wallet provider is swappable by design — `UnifiedProvider` is already satisfied by two
 * unrelated implementations (Farcaster and WalletConnect), and `ProviderRegistry` imports each
 * dynamically so neither drags the other into a bundle. What makes a third one cheap is that
 * `@reown/*` never appears outside the files that exist to adapt it.
 *
 * This is the same rule `wallet-abstraction.test.ts` applies to Web3Auth, which is the provider
 * this estate migrated AWAY from. That test was added after the migration to stop the old
 * provider creeping back; this one is added before the next migration, for the same reason in
 * advance.
 *
 * ⚠️ WHAT LEAKAGE COSTS. An `@reown` import in a component or page is not a compile error and
 *    not a test failure — it works perfectly, right up until somebody tries to add a provider
 *    beside it and discovers the app is talking to AppKit directly in a dozen places. The
 *    damage is done long before anybody notices, which is exactly the shape a test can prevent
 *    and review cannot.
 *
 * ⚠️ AUTH IS NOT ON THIS LIST, AND THAT IS THE POINT. The backend takes
 *    `{ message, signature }` and recovers the address; it has no idea which library signed.
 *    The SIWX classes below are adapters that let AppKit drive that contract — they are not the
 *    contract. `lib/auth/walletAuthClient.ts` is, and it imports nothing from Reown.
 */

import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '../../');

const SCAN_DIRS = ['components', 'pages', 'utils', 'lib', 'hooks', 'packages/whitelabel-sdk/src'];

/**
 * The only files permitted to import `@reown/*`.
 *
 * Adding one here is a deliberate act with a cost attached: every entry is a file that a future
 * provider swap has to read. Prefer putting the logic behind `UnifiedProvider` or
 * `walletAuthClient` and leaving this list alone.
 */
const ADAPTERS = [
  // The connection itself. The only caller of createAppKit anywhere.
  'packages/whitelabel-sdk/src/components/auth/reownWalletConnect.tsx',
  // SIWX adapters: AppKit insists on driving the session lifecycle, so these subclass its
  // interfaces and delegate to walletAuthClient. A different provider needs none of them.
  'packages/whitelabel-sdk/src/lib/auth/siwx-config.ts',
  'packages/whitelabel-sdk/src/lib/auth/EmbeddedOnlySIWX.ts',
  'packages/whitelabel-sdk/src/lib/auth/BackendSIWXStorage.ts',
  'packages/whitelabel-sdk/src/lib/auth/BackendSIWXMessenger.ts',
];

const REOWN_IMPORT = /(?:import|require)\s*(?:[^'"]*from\s*)?\(?\s*['"]@reown\/[^'"]*['"]/;

/**
 * The adapter MODULE, as distinct from the Reown PACKAGE. `reownWalletConnect.tsx` imports
 * nothing a caller should want except through `UnifiedProvider`, and importing it directly is
 * how Reown's vocabulary escapes without a single `@reown/` import appearing anywhere.
 *
 * ⚠️ THIS IS THE ONE THE FIRST VERSION MISSED. `AuthManager` imported `ConnectionMode` from
 *    here — a type, so nothing bundled, and not an `@reown/` path, so the rule above was
 *    satisfied — and then called `getProvider('walletconnect')` to deliver it. A second
 *    provider's `setConnectionMode` was unreachable, and every test passed.
 */
const ADAPTER_MODULE = /from\s*['"](?:@\/components\/auth\/|\.\/)reownWalletConnect['"]/;
const ADAPTER_MODULE_IMPORTERS = [
  ...ADAPTERS,
  // The UnifiedProvider implementation that wraps the adapter. It is the bridge, so it is the
  // one place outside the adapters that is allowed to know the adapter exists.
  'packages/whitelabel-sdk/src/lib/auth/providers/WalletConnectProvider.ts',
];

/** Where the registry, manager and token logic live. Nothing in here may name a provider. */
const CORE_DIR = 'packages/whitelabel-sdk/src/lib/auth/core';
const MANIFEST = `${CORE_DIR}/providerManifest.ts`;

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

describe('Reown is confined to its adapters', () => {
  const files = SCAN_DIRS.flatMap(sourceFiles);

  it('scans a meaningful number of files', () => {
    // Guards the guard: a broken path list would make every assertion below vacuously pass.
    expect(files.length).toBeGreaterThan(100);
  });

  it('is imported only by the files that exist to adapt it', () => {
    const offenders = files.filter(
      (f) => !ADAPTERS.includes(f) && REOWN_IMPORT.test(fs.readFileSync(path.join(ROOT, f), 'utf8'))
    );

    expect(offenders).toEqual([]);
  });

  it('every listed adapter still exists', () => {
    // A stale entry is worse than none: it quietly widens the allowance for a path that has
    // moved, and the file at the new path is then unpoliced.
    const missing = ADAPTERS.filter((f) => !fs.existsSync(path.join(ROOT, f)));

    expect(missing).toEqual([]);
  });

  it('the auth contract itself names no provider', () => {
    // ⚠️ THE LOAD-BEARING ONE. The backend takes { message, signature } — anything holding a
    //    private key satisfies it. If Reown ever appears in here, the auth path has stopped
    //    being portable and a provider swap has become a rewrite.
    const client = path.join(ROOT, 'packages/whitelabel-sdk/src/lib/auth/walletAuthClient.ts');
    const source = fs.readFileSync(client, 'utf8');

    expect(REOWN_IMPORT.test(source)).toBe(false);
    expect(source).toContain('/api/auth/siwe/verify');
  });

  it('createAppKit is called in exactly one place', () => {
    // ⚠️ COMMENT LINES ARE STRIPPED FIRST. The first version of this matched prose — a doc
    //    comment in EmbeddedOnlySIWX.ts reading "WHY THIS IS A CLASS AND NOT A CONDITIONAL AT
    //    createAppKit()" failed the test. A rule that fires on discussion of the thing rather
    //    than use of it gets relaxed rather than obeyed, which is how a guard stops guarding.
    const code = (f: string) =>
      fs
        .readFileSync(path.join(ROOT, f), 'utf8')
        .split('\n')
        .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
        .join('\n');

    const callers = files.filter((f) => /createAppKit\s*\(/.test(code(f)));

    // AppKit is a singleton that cannot be torn down and recreated, so a second construction
    // site is not a style problem — it is a race with no recovery.
    expect(callers).toEqual(['packages/whitelabel-sdk/src/components/auth/reownWalletConnect.tsx']);
  });

  it('the adapter module is imported only by the files that bridge it', () => {
    const offenders = files.filter(
      (f) =>
        !ADAPTER_MODULE_IMPORTERS.includes(f) &&
        ADAPTER_MODULE.test(fs.readFileSync(path.join(ROOT, f), 'utf8'))
    );

    expect(offenders).toEqual([]);
  });

  it('core names no provider', () => {
    // ⚠️ `getProvider('walletconnect')` is not an import and matches no path rule, and it is
    //    the most direct way to make a second provider a no-op: whatever the manifest chose,
    //    the call goes to the one that was there first. The manifest is the ONLY file in core
    //    allowed to spell a provider's name.
    const code = (f: string) =>
      fs
        .readFileSync(path.join(ROOT, f), 'utf8')
        .split('\n')
        .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
        .join('\n');

    const offenders = files
      .filter((f) => f.startsWith(CORE_DIR + '/') && f !== MANIFEST)
      .filter((f) => /['"](walletconnect|farcaster|privy)['"]/.test(code(f)));

    expect(offenders).toEqual([]);
  });
});
