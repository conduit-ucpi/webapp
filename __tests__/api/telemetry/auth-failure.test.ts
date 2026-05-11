/**
 * Tests for /api/telemetry/auth-failure.
 *
 * Lightweight POST endpoint that emits a single structured log line so we
 * can grep aggregate counts of auth failures from container stdout. No DB,
 * no PII — just kind/context/message/userAgent/ts.
 */

import handler from '@/pages/api/telemetry/auth-failure';

function makeReqRes(req: Partial<{ method: string; body: any; headers: any }> = {}) {
  const setHeader = jest.fn();
  const status = jest.fn();
  const json = jest.fn();
  const end = jest.fn();
  const res: any = { setHeader, status, json, end };
  status.mockReturnValue(res);

  const fullReq: any = {
    method: req.method ?? 'POST',
    body: req.body ?? {},
    headers: req.headers ?? { 'user-agent': 'jest-test' },
  };

  return { req: fullReq, res };
}

describe('/api/telemetry/auth-failure', () => {
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('rejects non-POST methods with 405', () => {
    const { req, res } = makeReqRes({ method: 'GET' });
    handler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: 'Method not allowed' });
  });

  it('emits a single structured log line on a valid POST', () => {
    const { req, res } = makeReqRes({
      body: { kind: 'wallet-signing', context: 'request-authentication', message: 'magic blocked' },
    });

    handler(req, res);

    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy.mock.calls[0][0]).toBe('[telemetry] auth-failure');
    const payload = JSON.parse(logSpy.mock.calls[0][1] as string);
    expect(payload.kind).toBe('wallet-signing');
    expect(payload.context).toBe('request-authentication');
    expect(payload.message).toBe('magic blocked');
    expect(payload.userAgent).toBe('jest-test');
    expect(typeof payload.ts).toBe('number');
  });

  it('responds 204 (no body) on success', () => {
    const { req, res } = makeReqRes({
      body: { kind: 'magic-blocked', context: 'pre-flight' },
    });

    handler(req, res);

    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.end).toHaveBeenCalled();
  });

  it('coerces unknown kind to "unknown"', () => {
    const { req, res } = makeReqRes({
      body: { kind: 'pwn3d', context: 'pre-flight' },
    });

    handler(req, res);

    const payload = JSON.parse(logSpy.mock.calls[0][1] as string);
    expect(payload.kind).toBe('unknown');
  });

  it('coerces unknown context to "unknown"', () => {
    const { req, res } = makeReqRes({
      body: { kind: 'wallet-signing', context: 'haxxor' },
    });

    handler(req, res);

    const payload = JSON.parse(logSpy.mock.calls[0][1] as string);
    expect(payload.context).toBe('unknown');
  });

  it('caps message length at 200 chars (log injection defense)', () => {
    const long = 'A'.repeat(500);
    const { req, res } = makeReqRes({
      body: { kind: 'wallet-signing', context: 'siwe-verify', message: long },
    });

    handler(req, res);

    const payload = JSON.parse(logSpy.mock.calls[0][1] as string);
    expect(payload.message.length).toBe(200);
  });

  it('caps userAgent length', () => {
    const longUA = 'X'.repeat(500);
    const { req, res } = makeReqRes({
      body: { kind: 'unknown', context: 'pre-flight' },
      headers: { 'user-agent': longUA },
    });

    handler(req, res);

    const payload = JSON.parse(logSpy.mock.calls[0][1] as string);
    expect(payload.userAgent.length).toBeLessThanOrEqual(200);
  });

  it('handles a missing body gracefully', () => {
    const { req, res } = makeReqRes({ body: undefined });

    expect(() => handler(req, res)).not.toThrow();
    expect(res.status).toHaveBeenCalledWith(204);
  });
});
