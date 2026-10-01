/**
 * The prepare proxy: ap2service's prepare_escrow_payment over HTTP, unauthenticated like /reserve.
 */
import { createMocks } from 'node-mocks-http';
import handler from '@/pages/api/ap2/prepare';
import * as serviceProxy from '@/lib/server/serviceProxy';

jest.mock('@/lib/server/serviceProxy', () => ({
  ...jest.requireActual('@/lib/server/serviceProxy'),
  proxyToService: jest.fn()
}));

const proxyToService = serviceProxy.proxyToService as jest.Mock;

const TERMS = {
  seller: 'merchant@example.com',
  amount: 10000000,
  expiry_timestamp: 1793500000,
  nominal_buyer: 'person@example.com',
  description: 'Logo design',
  product_name: 'Logo'
};

describe('POST /api/ap2/prepare', () => {
  beforeEach(() => proxyToService.mockReset());

  it('carries the terms to ap2service, unauthenticated: it moves nothing and emails nobody', async () => {
    const { req, res } = createMocks({ method: 'POST', body: TERMS });
    await handler(req as any, res as any);

    const options = proxyToService.mock.calls[0][2];
    expect(options.service).toBe('ap2');
    expect(options.path).toBe('/prepare');
    expect(options.requiresAuth).toBe(false);
    expect(options.body).toEqual(TERMS);
  });

  it.each(['expiry_timestamp', 'nominal_buyer'])('names a missing %s without asking ap2service', async (field) => {
    const { req, res } = createMocks({ method: 'POST', body: { ...TERMS, [field]: undefined } });
    await handler(req as any, res as any);

    expect(res._getStatusCode()).toBe(400);
    expect(JSON.parse(res._getData()).error).toContain(field);
    expect(proxyToService).not.toHaveBeenCalled();
  });
});
