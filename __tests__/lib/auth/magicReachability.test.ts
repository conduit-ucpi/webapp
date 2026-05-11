/**
 * Tests for the magic.com reachability pre-flight.
 *
 * Reown's social-login embedded wallet calls tee.express.magiclabs.com to
 * sign messages. If the user's network blocks it (BT Web Protect, NextDNS,
 * Pi-hole, ad-blockers), social/email login fails silently. This probe
 * detects that ahead of time so we can hide social options upfront.
 */

import {
  isMagicReachable,
  resetMagicReachabilityCache,
} from '@/lib/auth/magicReachability';

describe('isMagicReachable', () => {
  beforeEach(() => {
    resetMagicReachabilityCache();
    jest.restoreAllMocks();
  });

  it('returns true when fetch resolves (host reachable)', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 } as any) as any;

    await expect(isMagicReachable()).resolves.toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('returns false when fetch throws (DNS / connection refused)', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new TypeError('Failed to fetch')) as any;

    await expect(isMagicReachable()).resolves.toBe(false);
  });

  it('returns false on AbortError (timeout)', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' })) as any;

    await expect(isMagicReachable()).resolves.toBe(false);
  });

  it('caches the result — second call does not re-fetch', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 } as any) as any;

    const a = await isMagicReachable();
    const b = await isMagicReachable();
    const c = await isMagicReachable();

    expect(a).toBe(true);
    expect(b).toBe(true);
    expect(c).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('caches negative results too — does not retry on every call', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new TypeError('Failed to fetch')) as any;

    await isMagicReachable();
    await isMagicReachable();
    await isMagicReachable();

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('targets tee.express.magiclabs.com', async () => {
    const spy = jest.fn().mockResolvedValue({ ok: true, status: 200 } as any);
    global.fetch = spy as any;

    await isMagicReachable();

    const url = spy.mock.calls[0][0] as string;
    expect(url).toContain('tee.express.magiclabs.com');
  });

  it('uses no-cors mode and HEAD method (cheap probe, no CORS noise)', async () => {
    const spy = jest.fn().mockResolvedValue({ ok: true, status: 200 } as any);
    global.fetch = spy as any;

    await isMagicReachable();

    const init = spy.mock.calls[0][1] as RequestInit;
    expect(init.mode).toBe('no-cors');
    expect(init.method).toBe('HEAD');
    expect(init.credentials).toBe('omit');
  });

  it('resetMagicReachabilityCache forces a fresh probe', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 } as any) as any;

    await isMagicReachable();
    expect(global.fetch).toHaveBeenCalledTimes(1);

    resetMagicReachabilityCache();
    await isMagicReachable();
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
