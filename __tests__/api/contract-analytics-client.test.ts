/**
 * The buyer's GA client id, forwarded to contractservice with their session. contractservice checks
 * the caller is the buyer and the id's shape; only `clientId` is ever forwarded.
 */

import { createMocks } from 'node-mocks-http';
import handler from '@/pages/api/contracts/[id]/analytics-client';
import * as serviceProxy from '@/lib/server/serviceProxy';

jest.mock('@/lib/server/serviceProxy', () => ({
  ...jest.requireActual('@/lib/server/serviceProxy'),
  proxyToService: jest.fn()
}));

const proxyToService = serviceProxy.proxyToService as jest.Mock;

describe('POST /api/contracts/[id]/analytics-client', () => {
  beforeEach(() => proxyToService.mockReset());

  it("needs the buyer's session, and forwards only the client id", async () => {
    const { req, res } = createMocks({
      method: 'POST',
      query: { id: '507f1f77bcf86cd799439011' },
      body: { clientId: '1234567890.1729600000', gaClientIdAt: 0, buyerAddress: '0xevil' }
    });

    await handler(req as any, res as any);

    const options = proxyToService.mock.calls[0][2];
    expect(options.service).toBe('contract');
    expect(options.path).toBe('/api/contracts/507f1f77bcf86cd799439011/analytics-client');
    expect(options.requiresAuth).not.toBe(false);
    expect(options.body).toEqual({ clientId: '1234567890.1729600000' });
  });

  it('refuses an id that could change the path', async () => {
    const { req, res } = createMocks({ method: 'POST', query: { id: '../admin/x' }, body: { clientId: '1.2' } });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(400);
    expect(proxyToService).not.toHaveBeenCalled();
  });

  it('refuses a body without a client id', async () => {
    const { req, res } = createMocks({ method: 'POST', query: { id: 'abc' }, body: {} });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(400);
    expect(proxyToService).not.toHaveBeenCalled();
  });

  it('only answers POST', async () => {
    const { req, res } = createMocks({ method: 'GET', query: { id: 'abc' } });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(405);
    expect(proxyToService).not.toHaveBeenCalled();
  });
});
