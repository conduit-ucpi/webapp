/**
 * Tests for reportAuthFailure: a fire-and-forget telemetry helper that POSTs
 * to /api/telemetry/auth-failure. Must NEVER throw, even when fetch fails,
 * so it can never break the user-facing flow it's instrumenting.
 */

import { reportAuthFailure } from '@/lib/auth/reportAuthFailure';

describe('reportAuthFailure', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('POSTs to /api/telemetry/auth-failure with kind, context, message', () => {
    const spy = jest.fn().mockResolvedValue({ ok: true, status: 204 } as any);
    global.fetch = spy as any;

    reportAuthFailure('wallet-signing', 'request-authentication', 'msg');

    expect(spy).toHaveBeenCalledTimes(1);
    const [url, init] = spy.mock.calls[0];
    expect(url).toBe('/api/telemetry/auth-failure');
    expect((init as RequestInit).method).toBe('POST');

    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toEqual({
      kind: 'wallet-signing',
      context: 'request-authentication',
      message: 'msg',
    });
  });

  it('omits the message field when not provided', () => {
    const spy = jest.fn().mockResolvedValue({ ok: true, status: 204 } as any);
    global.fetch = spy as any;

    reportAuthFailure('magic-blocked', 'pre-flight');

    const init = spy.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body.kind).toBe('magic-blocked');
    expect(body.context).toBe('pre-flight');
    expect(body.message).toBeUndefined();
  });

  it('uses keepalive so the request survives navigation', () => {
    const spy = jest.fn().mockResolvedValue({ ok: true, status: 204 } as any);
    global.fetch = spy as any;

    reportAuthFailure('network', 'siwe-verify');

    const init = spy.mock.calls[0][1] as RequestInit;
    expect(init.keepalive).toBe(true);
  });

  it('does not throw when fetch rejects', () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new TypeError('Failed to fetch')) as any;

    expect(() =>
      reportAuthFailure('network', 'siwe-verify', 'whatever')
    ).not.toThrow();
  });

  it('does not throw when fetch itself throws synchronously', () => {
    global.fetch = jest.fn().mockImplementation(() => {
      throw new Error('synchronous boom');
    }) as any;

    expect(() =>
      reportAuthFailure('unknown', 'request-authentication')
    ).not.toThrow();
  });

  it('does nothing (and does not throw) when fetch is undefined', () => {
    const original = global.fetch;
    // @ts-expect-error - simulating SSR or non-browser env
    delete global.fetch;
    try {
      expect(() =>
        reportAuthFailure('unknown', 'pre-flight')
      ).not.toThrow();
    } finally {
      global.fetch = original;
    }
  });
});
