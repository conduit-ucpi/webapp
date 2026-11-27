/**
 * The reserve proxy: carries an escrow's terms to ap2service to be put on file, decides nothing.
 */

import { createMocks } from 'node-mocks-http';
import handler from '@/pages/api/ap2/reserve';
import * as serviceProxy from '@/lib/server/serviceProxy';

jest.mock('@/lib/server/serviceProxy', () => ({
  ...jest.requireActual('@/lib/server/serviceProxy'),
  proxyToService: jest.fn()
}));

const proxyToService = serviceProxy.proxyToService as jest.Mock;

const TERMS = {
  seller: 'merchant@example.com',
  token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  amount: 1000000,
  expiry_timestamp: 1793500000,
  external_id: 'mcp-1',
  description: 'Logo design',
  buyer_claims: { 'stabledrop.nominal_buyer_account': 'eip155:8453:0x39C3236A2F7FCE4Cc215a24fFb32aC48646b2288' }
};

describe('POST /api/ap2/reserve', () => {
  beforeEach(() => proxyToService.mockReset());

  it('carries the terms to ap2service, unauthenticated like /settle', async () => {
    const { req, res } = createMocks({ method: 'POST', body: TERMS });

    await handler(req as any, res as any);

    const options = proxyToService.mock.calls[0][2];
    expect(options.service).toBe('ap2');
    expect(options.path).toBe('/reserve');
    expect(options.requiresAuth).toBe(false);
    expect(options.body).toEqual(TERMS);
  });

  it('never forwards an authorization: reserving relays nothing', async () => {
    const { req, res } = createMocks({ method: 'POST', body: { ...TERMS, eip3009: { signature: '0x1' } } });

    await handler(req as any, res as any);

    expect(proxyToService.mock.calls[0][2].body).not.toHaveProperty('eip3009');
  });

  it('names a missing term without asking ap2service', async () => {
    const { req, res } = createMocks({ method: 'POST', body: { ...TERMS, external_id: undefined } });

    await handler(req as any, res as any);

    expect(res._getStatusCode()).toBe(400);
    expect(JSON.parse(res._getData()).error).toContain('external_id');
    expect(proxyToService).not.toHaveBeenCalled();
  });
});
