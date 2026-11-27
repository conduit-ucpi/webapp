/**
 * Asking for a recorded escrow's buyer to be emailed: a signed-in seller's request, forwarded to
 * contractservice, which decides everything — including the link. The body is never forwarded.
 */

import { createMocks } from 'node-mocks-http';
import handler from '@/pages/api/escrow-records/[id]/request-email';
import * as serviceProxy from '@/lib/server/serviceProxy';

jest.mock('@/lib/server/serviceProxy', () => ({
  ...jest.requireActual('@/lib/server/serviceProxy'),
  proxyToService: jest.fn()
}));

const proxyToService = serviceProxy.proxyToService as jest.Mock;

describe('POST /api/escrow-records/[id]/request-email', () => {
  beforeEach(() => proxyToService.mockReset());

  it("needs the seller's session, and sends nothing the caller chose", async () => {
    const { req, res } = createMocks({
      method: 'POST',
      query: { id: '507f1f77bcf86cd799439011' },
      body: { link: 'https://evil.example/pay', to: 'victim@example.com' }
    });

    await handler(req as any, res as any);

    const options = proxyToService.mock.calls[0][2];
    expect(options.service).toBe('contract');
    expect(options.path).toBe('/api/escrow-records/507f1f77bcf86cd799439011/request-email');
    expect(options.requiresAuth).not.toBe(false);
    expect(options.body).toEqual({});
  });

  it('refuses an id that could change the path', async () => {
    const { req, res } = createMocks({ method: 'POST', query: { id: '../contracts/x' } });

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
