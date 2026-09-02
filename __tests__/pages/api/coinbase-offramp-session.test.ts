/**
 * Test: /api/coinbase/offramp/session
 *
 * Mints the session token for a cash-out. The security property that matters
 * here is the binding: the wallet the tokens will leave must be the signed-in
 * user's, and the ref Coinbase files the order under must come from the server's
 * identity lookup rather than from the request.
 */

import { createMocks } from 'node-mocks-http';
import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '@/pages/api/coinbase/offramp/session';

type RequestMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';

jest.mock('@coinbase/cdp-sdk/auth', () => ({
  generateJwt: jest.fn(),
}));

import { generateJwt } from '@coinbase/cdp-sdk/auth';

const mockGenerateJwt = generateJwt as jest.MockedFunction<typeof generateJwt>;

const WALLET = '0x1234567890abcdef1234567890abcdef12345678';
const OTHER_WALLET = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';

describe('/api/coinbase/offramp/session', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      COINBASE_API_KEY_ID: 'test-key-id',
      COINBASE_API_KEY_SECRET: 'test-key-secret',
      USER_SERVICE_URL: 'https://userservice.test',
    };
    global.fetch = jest.fn();
    mockGenerateJwt.mockResolvedValue('mock-jwt-token');
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  function makeReq(
    opts: {
      method?: RequestMethod;
      body?: unknown;
      cookie?: string;
    } = {}
  ) {
    const headers: Record<string, string> = { 'x-forwarded-for': '203.0.113.42' };
    if (opts.cookie) headers.cookie = opts.cookie;

    const mocks = createMocks({
      method: opts.method ?? 'POST',
      body: opts.body ?? { address: WALLET, asset: 'USDC', network: 'base' },
      headers,
    });

    (mocks.req as any).socket = { remoteAddress: '127.0.0.1' };

    return {
      req: mocks.req as unknown as NextApiRequest,
      res: mocks.res as unknown as NextApiResponse & {
        _getStatusCode(): number;
        _getData(): string;
      },
    };
  }

  function mockIdentity(identity: Record<string, unknown>) {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/user/identity')) {
        return Promise.resolve({ ok: true, json: async () => identity });
      }
      if (url.includes('api.developer.coinbase.com')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ token: 'cb-sell-token' }),
        });
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });
  }

  it('rejects non-POST methods with 405', async () => {
    const { req, res } = makeReq({ method: 'GET' });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(405);
  });

  it('returns 503 when the server has no CDP credentials', async () => {
    delete process.env.COINBASE_API_KEY_SECRET;
    const { req, res } = makeReq({ cookie: 'AUTH-TOKEN=valid' });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(503);
  });

  it('returns 401 when unauthenticated', async () => {
    const { req, res } = makeReq();
    await handler(req, res);
    expect(res._getStatusCode()).toBe(401);
  });

  it('returns 401 when the user service rejects the session', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 401 });
    const { req, res } = makeReq({ cookie: 'AUTH-TOKEN=stale' });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(401);
  });

  it('refuses to set up a cash-out against a wallet that is not the signed-in one', async () => {
    mockIdentity({ userId: 'u1', walletAddress: OTHER_WALLET });
    const { req, res } = makeReq({ cookie: 'AUTH-TOKEN=valid' });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(403);
    const coinbaseCall = (global.fetch as jest.Mock).mock.calls.find(c =>
      String(c[0]).includes('coinbase.com')
    );
    expect(coinbaseCall).toBeUndefined();
  });

  it('accepts the signed-in wallet regardless of address casing', async () => {
    mockIdentity({ userId: 'u1', walletAddress: WALLET.toUpperCase().replace('0X', '0x') });
    const { req, res } = makeReq({ cookie: 'AUTH-TOKEN=valid' });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
  });

  it('returns 400 for a malformed address', async () => {
    mockIdentity({ userId: 'u1', walletAddress: WALLET });
    const { req, res } = makeReq({
      cookie: 'AUTH-TOKEN=valid',
      body: { address: 'nope', asset: 'USDC', network: 'base' },
    });

    await handler(req, res);
    expect(res._getStatusCode()).toBe(400);
  });

  it('returns 400 when the chain or token is missing rather than guessing one', async () => {
    mockIdentity({ userId: 'u1', walletAddress: WALLET });
    const { req, res } = makeReq({
      cookie: 'AUTH-TOKEN=valid',
      body: { address: WALLET, asset: 'USDC' },
    });

    await handler(req, res);
    expect(res._getStatusCode()).toBe(400);
  });

  it('mints a token for the requested chain and returns the server-derived partner ref', async () => {
    mockIdentity({ userId: 'u1', walletAddress: WALLET });
    const { req, res } = makeReq({
      cookie: 'AUTH-TOKEN=valid',
      body: { address: WALLET, asset: 'USDT', network: 'ethereum' },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toEqual({
      token: 'cb-sell-token',
      partnerUserRef: 'u1',
    });

    expect(mockGenerateJwt).toHaveBeenCalledWith(
      expect.objectContaining({
        requestMethod: 'POST',
        requestHost: 'api.developer.coinbase.com',
        requestPath: '/onramp/v1/token',
      })
    );

    const coinbaseCall = (global.fetch as jest.Mock).mock.calls.find(c =>
      String(c[0]).includes('coinbase.com')
    );
    expect(JSON.parse(coinbaseCall![1].body)).toEqual({
      addresses: [{ address: WALLET, blockchains: ['ethereum'] }],
      assets: ['USDT'],
      clientIp: '203.0.113.42',
    });
  });

  it('ignores any partner ref the client tries to supply', async () => {
    mockIdentity({ userId: 'u1', walletAddress: WALLET });
    const { req, res } = makeReq({
      cookie: 'AUTH-TOKEN=valid',
      body: { address: WALLET, asset: 'USDC', network: 'base', partnerUserRef: 'someone-else' },
    });

    await handler(req, res);

    expect(JSON.parse(res._getData()).partnerUserRef).toBe('u1');
  });

  it('falls back to the wallet address when the identity has no userId', async () => {
    mockIdentity({ walletAddress: WALLET });
    const { req, res } = makeReq({ cookie: 'AUTH-TOKEN=valid' });

    await handler(req, res);

    expect(JSON.parse(res._getData()).partnerUserRef).toBe(WALLET);
  });

  it('returns 502 when Coinbase rejects the request', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/user/identity')) {
        return Promise.resolve({ ok: true, json: async () => ({ userId: 'u1', walletAddress: WALLET }) });
      }
      return Promise.resolve({ ok: false, status: 400, text: async () => '{"error":"bad"}' });
    });

    const { req, res } = makeReq({ cookie: 'AUTH-TOKEN=valid' });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(502);
  });
});
