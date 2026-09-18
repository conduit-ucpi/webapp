/**
 * Adding a wallet provider should be one manifest entry and one file.
 *
 * It used to be five edits, three of them inside ProviderRegistry: an `if` in `initialize()`, a
 * `registerXProvider()` method, and a branch in `getBestProvider()`. The last of those is the
 * one that bites — forget it and the provider registers perfectly, reports success, and is
 * never selected, with nothing failing anywhere.
 */

import { ProviderRegistry } from '@/lib/auth/core/ProviderRegistry';
import { PROVIDERS } from '@/lib/auth/core/providerManifest';

describe('the provider manifest', () => {
  it('names every provider exactly once', () => {
    const types = PROVIDERS.map((p) => p.type);

    expect(new Set(types).size).toBe(types.length);
  });

  it('gives each provider a distinct priority', () => {
    // Ties would be broken by array order — invisible at the call site, and changed by anybody
    // who tidies the list. The registry throws on this too; here it fails before shipping.
    const priorities = PROVIDERS.map((p) => p.priority);

    expect(new Set(priorities).size).toBe(priorities.length);
  });

  it('describes each provider completely enough to register it', () => {
    for (const descriptor of PROVIDERS) {
      expect(typeof descriptor.type).toBe('string');
      expect(typeof descriptor.applies).toBe('function');
      expect(typeof descriptor.priority).toBe('number');
      expect(typeof descriptor.required).toBe('boolean');
      expect(typeof descriptor.load).toBe('function');
    }
  });

  it('loads every provider lazily', () => {
    // ⚠️ A STATIC IMPORT WOULD PUT EVERY WALLET SDK IN EVERY BUNDLE, including for a user who
    //    will only ever meet one of them. Reown alone is not small.
    //
    // ⚠️ CHECKED AGAINST THE SOURCE, NOT THE FUNCTION. `descriptor.load.toString()` returns the
    //    TRANSPILED body, where ts-jest has already rewritten `import()` into a require — so
    //    that version of this test failed while the code was entirely correct.
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.join(
        __dirname,
        '../../../packages/whitelabel-sdk/src/lib/auth/core/providerManifest.ts'
      ),
      'utf8'
    );

    // Matched on the import PATH, not the imported name — `UnifiedProvider` is a type and a
    // perfectly legitimate static import. Only `providers/` costs bundle weight.
    expect(source).not.toMatch(/^import[^;]*from '@\/lib\/auth\/providers\//m);
    expect((source.match(/await import\(/g) || []).length).toBe(PROVIDERS.length);
  });
});

describe('ProviderRegistry knows nothing about individual providers', () => {
  it('mentions no provider by name', () => {
    // ⚠️ THE ASSERTION THAT KEEPS THIS EASY. The moment a provider name appears here, adding
    //    the next one means editing this file too — which is the state this refactor removed.
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.join(
        __dirname,
        '../../../packages/whitelabel-sdk/src/lib/auth/core/ProviderRegistry.ts'
      ),
      'utf8'
    );
    const code = source
      .split('\n')
      .filter((line: string) => !/^\s*(\/\/|\*|\/\*)/.test(line))
      .join('\n');

    for (const descriptor of PROVIDERS) {
      expect(code).not.toContain(`'${descriptor.type}'`);
    }
  });
});

describe('selection follows priority', () => {
  const registry = () => new ProviderRegistry();

  it('prefers the highest priority provider that registered', () => {
    const r = registry() as unknown as { providers: Map<string, unknown> };
    const [highest, ...rest] = [...PROVIDERS].sort((a, b) => b.priority - a.priority);

    // Both present: the higher priority one wins.
    r.providers.set(highest.type, { name: highest.type });
    if (rest[0]) r.providers.set(rest[0].type, { name: rest[0].type });

    expect((registry() as ProviderRegistry).getBestProvider()).toBeNull(); // fresh one is empty
    expect((r as unknown as ProviderRegistry).getBestProvider()).toEqual({ name: highest.type });
  });

  it('falls through to a lower priority provider when the higher one did not register', () => {
    const r = registry() as unknown as { providers: Map<string, unknown> };
    const ordered = [...PROVIDERS].sort((a, b) => b.priority - a.priority);
    const lower = ordered[ordered.length - 1];

    r.providers.set(lower.type, { name: lower.type });

    expect((r as unknown as ProviderRegistry).getBestProvider()).toEqual({ name: lower.type });
  });

  it('returns null when nothing registered', () => {
    expect(registry().getBestProvider()).toBeNull();
  });
});
