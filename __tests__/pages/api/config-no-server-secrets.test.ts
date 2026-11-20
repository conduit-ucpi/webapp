/**
 * /api/config is public: anyone can read it, signed in or not. Until 2026-11-20 it carried
 * NEYNAR_API_KEY, which only the server ever used.
 */
import { createMocks } from 'node-mocks-http';
import { NextApiRequest, NextApiResponse } from 'next';
import handler, { clearConfigCache } from '@/pages/api/config';

global.fetch = jest.fn();

describe('/api/config keeps server-side keys to itself', () => {
  const originalEnv = process.env;
  const NEYNAR = 'neynar-key-that-must-stay-on-the-server';
  const SERVICE = 'service-key-that-must-stay-on-the-server';

  beforeEach(() => {
    jest.clearAllMocks();
    clearConfigCache();
    process.env = {
      ...originalEnv,
      RPC_URL: 'https://mainnet.base.org',
      CHAIN_ID: '8453',
      USDC_CONTRACT_ADDRESS: '0xUSDC123',
      CHAIN_SERVICE_URL: 'http://chainservice-internal:8978',
      USER_SERVICE_URL: 'http://userservice-internal:8977',
      CONTRACT_SERVICE_URL: 'http://contractservice-internal:8080',
      DEFAULT_TOKEN_SYMBOL: 'USDC',
      NEYNAR_API_KEY: NEYNAR,
      X_API_KEY: SERVICE,
      SHOPIFY_CLIENT_SECRET: SERVICE,
      SESSION_SECRET: SERVICE,
    };
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (String(url).includes('/api/chain/addresses')) {
        return Promise.resolve({ ok: true, json: async () => ({ factoryAddress: '0xFactory', implementationAddress: '0xImpl', timestamp: 1 }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ jsonrpc: '2.0', id: 1, result: '0x' }) });
    });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('answers without the Neynar key or any other server-side key, under any name', async () => {
    const { req, res } = createMocks({ method: 'GET' });

    await handler(req as NextApiRequest, res as NextApiResponse);

    expect(res._getStatusCode()).toBe(200);
    const body = res._getData();
    expect(JSON.parse(body)).not.toHaveProperty('neynarApiKey');
    expect(body).not.toContain(NEYNAR);
    expect(body).not.toContain(SERVICE);
  });

  it('does not say where the back-end services live', async () => {
    const { req, res } = createMocks({ method: 'GET' });

    await handler(req as NextApiRequest, res as NextApiResponse);

    const body = res._getData();
    for (const field of ['userServiceUrl', 'chainServiceUrl', 'contractServiceUrl']) {
      expect(JSON.parse(body)).not.toHaveProperty(field);
    }
    expect(body).not.toMatch(/-internal:\d+/);
  });
});
