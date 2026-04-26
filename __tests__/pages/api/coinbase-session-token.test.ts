/**
 * Test: /api/coinbase/session-token
 *
 * Mints a single-use Coinbase Onramp session token, scoped to a wallet address.
 * The route must reject unauthenticated requests, missing config, and bad input
 * before ever calling Coinbase.
 */

import { createMocks, RequestMethod } from 'node-mocks-http';
import handler from '@/pages/api/coinbase/session-token';

jest.mock('@coinbase/cdp-sdk/auth', () => ({
  generateJwt: jest.fn(),
}));

import { generateJwt } from '@coinbase/cdp-sdk/auth';

const mockGenerateJwt = generateJwt as jest.MockedFunction<typeof generateJwt>;

const VALID_ADDRESS = '0x1234567890abcdef1234567890abcdef12345678';

describe('/api/coinbase/session-token', () => {
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

  function makeReq(opts: { method?: RequestMethod; body?: unknown; cookie?: string } = {}) {
    return createMocks({
      method: opts.method ?? 'POST',
      body: opts.body ?? { address: VALID_ADDRESS },
      headers: opts.cookie ? { cookie: opts.cookie } : {},
    });
  }

  function mockUserServiceOk() {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/user/identity')) {
        return Promise.resolve({ ok: true, json: async () => ({ userId: 'u1' }) });
      }
      if (url.includes('api.developer.coinbase.com')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ token: 'cb-session-token-xyz', channel_id: 'ch1' }),
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

  it('returns 503 when Coinbase credentials are not configured', async () => {
    delete process.env.COINBASE_API_KEY_ID;
    const { req, res } = makeReq({ cookie: 'AUTH-TOKEN=valid' });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(503);
  });

  it('returns 401 when no auth token is present', async () => {
    const { req, res } = makeReq();
    await handler(req, res);
    expect(res._getStatusCode()).toBe(401);
  });

  it('returns 401 when user service rejects the session', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 401 });
    const { req, res } = makeReq({ cookie: 'AUTH-TOKEN=stale' });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(401);
  });

  it('returns 400 for an invalid wallet address', async () => {
    mockUserServiceOk();
    const { req, res } = makeReq({ cookie: 'AUTH-TOKEN=valid', body: { address: 'not-an-address' } });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(400);
  });

  it('mints a JWT scoped to POST /onramp/v1/token and returns the Coinbase token', async () => {
    mockUserServiceOk();
    const { req, res } = makeReq({ cookie: 'AUTH-TOKEN=valid' });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toEqual({ token: 'cb-session-token-xyz' });

    expect(mockGenerateJwt).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKeyId: 'test-key-id',
        apiKeySecret: 'test-key-secret',
        requestMethod: 'POST',
        requestHost: 'api.developer.coinbase.com',
        requestPath: '/onramp/v1/token',
      })
    );

    const coinbaseCall = (global.fetch as jest.Mock).mock.calls.find(c => String(c[0]).includes('coinbase.com'));
    expect(coinbaseCall).toBeDefined();
    expect(coinbaseCall![1].headers.Authorization).toBe('Bearer mock-jwt-token');
    const sentBody = JSON.parse(coinbaseCall![1].body);
    expect(sentBody).toEqual({
      addresses: [{ address: VALID_ADDRESS, blockchains: ['base'] }],
      assets: ['USDC'],
    });
  });

  it('honors blockchain and asset overrides from the request body', async () => {
    mockUserServiceOk();
    const { req, res } = makeReq({
      cookie: 'AUTH-TOKEN=valid',
      body: { address: VALID_ADDRESS, blockchain: 'ethereum', asset: 'ETH' },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const coinbaseCall = (global.fetch as jest.Mock).mock.calls.find(c => String(c[0]).includes('coinbase.com'));
    const sentBody = JSON.parse(coinbaseCall![1].body);
    expect(sentBody.addresses[0].blockchains).toEqual(['ethereum']);
    expect(sentBody.assets).toEqual(['ETH']);
  });

  it('returns 502 when Coinbase rejects the request', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/user/identity')) {
        return Promise.resolve({ ok: true, json: async () => ({ userId: 'u1' }) });
      }
      return Promise.resolve({ ok: false, status: 400, text: async () => '{"error":"bad request"}' });
    });

    const { req, res } = makeReq({ cookie: 'AUTH-TOKEN=valid' });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(502);
  });

  it('returns 502 when Coinbase response is missing the token field', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/user/identity')) {
        return Promise.resolve({ ok: true, json: async () => ({ userId: 'u1' }) });
      }
      return Promise.resolve({ ok: true, status: 200, text: async () => JSON.stringify({}) });
    });

    const { req, res } = makeReq({ cookie: 'AUTH-TOKEN=valid' });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(502);
  });
});
