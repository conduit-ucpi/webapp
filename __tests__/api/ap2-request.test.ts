/**
 * The payment-request proxies: /create's request, and paying one, both made AS THE SIGNED-IN USER.
 */
import { createMocks } from 'node-mocks-http';
import createHandler from '@/pages/api/ap2/request';
import prepareHandler from '@/pages/api/ap2/request/[id]/prepare';
import * as serviceProxy from '@/lib/server/serviceProxy';

jest.mock('@/lib/server/serviceProxy', () => ({
  ...jest.requireActual('@/lib/server/serviceProxy'),
  proxyToService: jest.fn()
}));

const proxyToService = serviceProxy.proxyToService as jest.Mock;

const REQUEST = { amount: 25000000, expiry_timestamp: 1893456000, description: 'Logo design' };

describe('POST /api/ap2/request', () => {
  beforeEach(() => proxyToService.mockReset());

  it('carries the terms to ap2service and requires a session: the request is in the seller’s name', async () => {
    const { req, res } = createMocks({ method: 'POST', body: REQUEST });
    await createHandler(req as any, res as any);

    const options = proxyToService.mock.calls[0][2];
    expect(options.path).toBe('/request');
    expect(options.requiresAuth).not.toBe(false);
    expect(options.body).toEqual(REQUEST);
  });

  it('names a missing field without asking ap2service', async () => {
    const { req, res } = createMocks({ method: 'POST', body: { ...REQUEST, description: undefined } });
    await createHandler(req as any, res as any);

    expect(res._getStatusCode()).toBe(400);
    expect(proxyToService).not.toHaveBeenCalled();
  });
});

describe('POST /api/ap2/request/[id]/prepare', () => {
  beforeEach(() => proxyToService.mockReset());

  it('sends only the payer: every term comes from the stored request', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      query: { id: 'abc123' },
      body: { payer: '0xb', seller: '0xevil', amount: 1 }
    });
    await prepareHandler(req as any, res as any);

    const options = proxyToService.mock.calls[0][2];
    expect(options.path).toBe('/request/abc123/prepare');
    expect(options.requiresAuth).not.toBe(false);
    expect(options.body).toEqual({ payer: '0xb' });
  });

  it.each(['../admin', 'a/b', ''])('refuses an id that is not one (%p)', async (id) => {
    const { req, res } = createMocks({ method: 'POST', query: { id }, body: {} });
    await prepareHandler(req as any, res as any);

    expect(res._getStatusCode()).toBe(400);
    expect(proxyToService).not.toHaveBeenCalled();
  });
});
