/**
 * Test: /api/coinbase/offramp/pending and the order-selection rule behind it.
 *
 * This route decides whether the app is about to move a user's money, so the
 * selection rule gets tested directly as well as through the handler. Two
 * mistakes it exists to prevent: sending a second time against an order Coinbase
 * has already seen funds for (STARTED), and sending into a dead deposit address
 * belonging to an order that timed out but still reads as CREATED.
 */

import { createMocks } from 'node-mocks-http';
import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '@/pages/api/coinbase/offramp/pending';
import { selectPendingOrder, OFFRAMP_WINDOW_MS } from '@/lib/server/coinbaseOfframp';

type RequestMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';

jest.mock('@coinbase/cdp-sdk/auth', () => ({
  generateJwt: jest.fn(),
}));

import { generateJwt } from '@coinbase/cdp-sdk/auth';

const mockGenerateJwt = generateJwt as jest.MockedFunction<typeof generateJwt>;

const WALLET = '0x1234567890abcdef1234567890abcdef12345678';
const COINBASE_DEPOSIT = '0x9999999999999999999999999999999999999999';

const NOW = Date.parse('2026-09-02T12:00:00.000Z');

function tx(overrides: Record<string, unknown> = {}) {
  return {
    transaction_id: 'tx-1',
    status: 'CREATED',
    to_address: COINBASE_DEPOSIT,
    asset: 'USDC',
    network: 'base',
    sell_amount: { currency: 'USDC', value: '25.00' },
    created_at: new Date(NOW - 60_000).toISOString(),
    ...overrides,
  };
}

describe('selectPendingOrder', () => {
  it('returns the order that is still waiting on us to send', () => {
    const order = selectPendingOrder([tx()], NOW);

    expect(order).toMatchObject({
      transactionId: 'tx-1',
      toAddress: COINBASE_DEPOSIT,
      amount: '25.00',
      currency: 'USDC',
      network: 'base',
    });
  });

  it('reports when the order expires, so the panel can count down', () => {
    const createdAt = new Date(NOW - 60_000).toISOString();
    const order = selectPendingOrder([tx({ created_at: createdAt })], NOW);

    expect(Date.parse(order!.expiresAt)).toBe(Date.parse(createdAt) + OFFRAMP_WINDOW_MS);
  });

  it('ignores STARTED — Coinbase already saw funds, sending again would pay twice', () => {
    expect(selectPendingOrder([tx({ status: 'STARTED' })], NOW)).toBeNull();
  });

  it.each(['SUCCESS', 'FAILED', 'EXPIRED'])('ignores %s orders', status => {
    expect(selectPendingOrder([tx({ status })], NOW)).toBeNull();
  });

  it('ignores an order older than the 30 minute window even if it still reads CREATED', () => {
    const stale = tx({ created_at: new Date(NOW - OFFRAMP_WINDOW_MS - 1000).toISOString() });
    expect(selectPendingOrder([stale], NOW)).toBeNull();
  });

  it('picks the newest of several live orders', () => {
    const older = tx({ transaction_id: 'old', created_at: new Date(NOW - 600_000).toISOString() });
    const newer = tx({ transaction_id: 'new', created_at: new Date(NOW - 30_000).toISOString() });

    expect(selectPendingOrder([older, newer], NOW)!.transactionId).toBe('new');
    expect(selectPendingOrder([newer, older], NOW)!.transactionId).toBe('new');
  });

  it('skips an order with no deposit address rather than returning a half-formed one', () => {
    expect(selectPendingOrder([tx({ to_address: undefined })], NOW)).toBeNull();
  });

  it('skips an order with no amount', () => {
    expect(selectPendingOrder([tx({ sell_amount: { currency: 'USDC' } })], NOW)).toBeNull();
  });

  it('returns null for an empty history', () => {
    expect(selectPendingOrder([], NOW)).toBeNull();
  });
});

describe('/api/coinbase/offramp/pending', () => {
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

  function makeReq(opts: { method?: RequestMethod; cookie?: string; query?: any } = {}) {
    const headers: Record<string, string> = {};
    if (opts.cookie) headers.cookie = opts.cookie;

    const mocks = createMocks({
      method: opts.method ?? 'GET',
      headers,
      query: opts.query ?? {},
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

  function mockCoinbase(identity: Record<string, unknown>, transactions: unknown[]) {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/user/identity')) {
        return Promise.resolve({ ok: true, json: async () => identity });
      }
      if (url.includes('api.developer.coinbase.com')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ transactions }),
        });
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });
  }

  it('rejects non-GET methods with 405', async () => {
    const { req, res } = makeReq({ method: 'POST' });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(405);
  });

  it('returns 401 when unauthenticated', async () => {
    const { req, res } = makeReq();
    await handler(req, res);
    expect(res._getStatusCode()).toBe(401);
  });

  it('returns 503 when the server has no CDP credentials', async () => {
    delete process.env.COINBASE_API_KEY_ID;
    const { req, res } = makeReq({ cookie: 'AUTH-TOKEN=valid' });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(503);
  });

  it('looks the order up under the session identity, not a ref from the query string', async () => {
    mockCoinbase({ userId: 'u1', walletAddress: WALLET }, [tx()]);
    const { req, res } = makeReq({
      cookie: 'AUTH-TOKEN=valid',
      query: { partnerUserRef: 'someone-else' },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const coinbaseCall = (global.fetch as jest.Mock).mock.calls.find(c =>
      String(c[0]).includes('coinbase.com')
    );
    expect(String(coinbaseCall![0])).toContain('/sell/user/u1/transactions');
    expect(String(coinbaseCall![0])).not.toContain('someone-else');
  });

  it('signs the JWT over the path without the query string', async () => {
    mockCoinbase({ userId: 'u1', walletAddress: WALLET }, []);
    const { req, res } = makeReq({ cookie: 'AUTH-TOKEN=valid' });

    await handler(req, res);

    expect(mockGenerateJwt).toHaveBeenCalledWith(
      expect.objectContaining({
        requestMethod: 'GET',
        requestPath: '/onramp/v1/sell/user/u1/transactions',
      })
    );
    const coinbaseCall = (global.fetch as jest.Mock).mock.calls.find(c =>
      String(c[0]).includes('coinbase.com')
    );
    expect(String(coinbaseCall![0])).toContain('pageSize=20');
  });

  it('returns the live order', async () => {
    mockCoinbase({ userId: 'u1', walletAddress: WALLET }, [
      tx({ created_at: new Date(Date.now() - 60_000).toISOString() }),
    ]);
    const { req, res } = makeReq({ cookie: 'AUTH-TOKEN=valid' });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData()).pending).toMatchObject({
      toAddress: COINBASE_DEPOSIT,
      amount: '25.00',
      currency: 'USDC',
    });
  });

  it('reports nothing pending for a user with no Coinbase history', async () => {
    // Verified against the live CDP API: an unknown ref returns 200 with an empty
    // list rather than a 404.
    mockCoinbase({ userId: 'u1', walletAddress: WALLET }, []);
    const { req, res } = makeReq({ cookie: 'AUTH-TOKEN=valid' });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toEqual({ pending: null, seen: [] });
  });

  it('reports what it did see when no order is actionable, so a miss can explain itself', async () => {
    mockCoinbase({ userId: 'u1', walletAddress: WALLET }, [
      tx({ status: 'SUCCESS', created_at: new Date(Date.now() - 120_000).toISOString() }),
    ]);
    const { req, res } = makeReq({ cookie: 'AUTH-TOKEN=valid' });

    await handler(req, res);

    const body = JSON.parse(res._getData());
    expect(body.pending).toBeNull();
    expect(body.seen).toHaveLength(1);
    expect(body.seen[0].status).toBe('SUCCESS');
    expect(body.seen[0].ageSeconds).toBeGreaterThanOrEqual(119);
  });

  it('omits the diagnostic when there is a real order to act on', async () => {
    mockCoinbase({ userId: 'u1', walletAddress: WALLET }, [
      tx({ created_at: new Date(Date.now() - 30_000).toISOString() }),
    ]);
    const { req, res } = makeReq({ cookie: 'AUTH-TOKEN=valid' });

    await handler(req, res);

    const body = JSON.parse(res._getData());
    expect(body.pending).not.toBeNull();
    expect(body.seen).toBeUndefined();
  });

  it('returns 502 when Coinbase fails, rather than claiming there is nothing pending', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/user/identity')) {
        return Promise.resolve({ ok: true, json: async () => ({ userId: 'u1', walletAddress: WALLET }) });
      }
      return Promise.resolve({ ok: false, status: 500, text: async () => 'boom' });
    });

    const { req, res } = makeReq({ cookie: 'AUTH-TOKEN=valid' });
    await handler(req, res);

    expect(res._getStatusCode()).toBe(502);
  });
});
