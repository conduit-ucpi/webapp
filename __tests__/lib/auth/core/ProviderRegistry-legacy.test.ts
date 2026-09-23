/**
 * A legacy provider is reachable by asking, never by being next in line.
 *
 * ⚠️ WHY THIS EXISTS. The app moved from Reown to Privy. A person who signed up under Reown has
 *    funds in a Reown embedded wallet that only Reown can open — the same email in Privy is a
 *    different wallet. So the old provider cannot simply vanish, and it cannot simply stay
 *    either: registering it at boot constructs AppKit for everyone, and letting it compete on
 *    priority would sign people into the wrong wallet. It is loaded on request and only then.
 */

jest.mock('@/utils/mobileLogger', () => ({
  mLog: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { ProviderRegistry } from '@/lib/auth/core/ProviderRegistry';
import type { ProviderDescriptor } from '@/lib/auth/core/providerManifest';
import { PROVIDERS } from '@/lib/auth/core/providerManifest';

const fakeProvider = (name: string) => ({
  getProviderName: () => name,
  initialize: jest.fn().mockResolvedValue(undefined),
});

function manifest(loads: Record<string, jest.Mock>): ProviderDescriptor[] {
  return [
    {
      type: 'old' as any,
      applies: (c: any) => Boolean(c.oldProjectId),
      legacy: (c: any) => Boolean(c.newAppId),
      priority: 10,
      required: true,
      load: loads.old,
    },
    {
      type: 'new' as any,
      applies: (c: any) => Boolean(c.newAppId),
      priority: 20,
      required: false,
      load: loads.new,
    },
  ];
}

const both = { oldProjectId: 'p', newAppId: 'a' } as any;
const oldOnly = { oldProjectId: 'p' } as any;

function setup() {
  const loads = {
    old: jest.fn(async () => fakeProvider('old')),
    new: jest.fn(async () => fakeProvider('new')),
  };
  return { loads, registry: new ProviderRegistry(manifest(loads)) };
}

describe('a legacy provider', () => {
  it('is not loaded at boot and does not win selection', async () => {
    const { loads, registry } = setup();

    await registry.initialize(both);

    expect(loads.old).not.toHaveBeenCalled();
    expect(registry.getBestProvider()?.getProviderName()).toBe('new');
    expect(registry.hasLegacyProvider()).toBe(true);
  });

  it('is loaded on request, once, and then handed back', async () => {
    const { loads, registry } = setup();
    await registry.initialize(both);

    const first = await registry.getLegacyProvider();
    const second = await registry.getLegacyProvider();

    expect(first?.getProviderName()).toBe('old');
    expect(second).toBe(first);
    expect(loads.old).toHaveBeenCalledTimes(1);
  });

  it('still never wins selection once it is registered', async () => {
    // A restored old-wallet session has it registered; an ordinary connect must not get it.
    const { registry } = setup();
    await registry.initialize(both, { includeLegacy: true });

    expect(registry.getBestProvider()?.getProviderName()).toBe('new');
  });

  it('is started at boot when asked, so a session under it can be restored', async () => {
    const { loads, registry } = setup();

    await registry.initialize(both, { includeLegacy: true });

    expect(loads.old).toHaveBeenCalledTimes(1);
  });

  it('is an ordinary contender in a config where nothing supersedes it', async () => {
    const { loads, registry } = setup();

    await registry.initialize(oldOnly);

    expect(loads.old).toHaveBeenCalledTimes(1);
    expect(registry.getBestProvider()?.getProviderName()).toBe('old');
    expect(registry.hasLegacyProvider()).toBe(false);
    expect(await registry.getLegacyProvider()).toBeNull();
  });

  it('failing to start is not fatal, unlike a required contender', async () => {
    const loads = {
      old: jest.fn(async () => { throw new Error('SDK blocked'); }),
      new: jest.fn(async () => fakeProvider('new')),
    };
    const registry = new ProviderRegistry(manifest(loads));

    await expect(registry.initialize(both, { includeLegacy: true })).resolves.toBeUndefined();
    await expect(new ProviderRegistry(manifest(loads)).initialize(oldOnly)).rejects.toThrow(/failed to register/);
  });
});

describe('the real manifest', () => {
  it('has a legacy provider exactly when a newer one supersedes it', () => {
    // Which providers is the manifest's business; that there IS an old-wallet route when the
    // switch has been thrown, and none before, is the property the tick box depends on.
    const superseded = PROVIDERS.filter((p) => p.legacy);
    expect(superseded.length).toBeGreaterThan(0);

    const before = { walletConnectProjectId: 'p' } as any;
    const after = { walletConnectProjectId: 'p', privyAppId: 'a' } as any;
    for (const p of superseded) {
      expect(p.applies(before) && !p.legacy!(before)).toBe(true);
      expect(p.applies(after) && p.legacy!(after)).toBe(true);
    }
  });
});
