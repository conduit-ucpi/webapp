/**
 * The party-resolution proxy: carries a wallet-or-email pair to ap2service and decides nothing.
 */

import { createMocks } from 'node-mocks-http';
import handler from '@/pages/api/ap2/parties/resolve';
import * as serviceProxy from '@/lib/server/serviceProxy';

jest.mock('@/lib/server/serviceProxy', () => ({
  ...jest.requireActual('@/lib/server/serviceProxy'),
  proxyToService: jest.fn()
}));

const proxyToService = serviceProxy.proxyToService as jest.Mock;

describe('POST /api/ap2/parties/resolve', () => {
  beforeEach(() => proxyToService.mockReset());

  it('carries both parties to ap2service, whether wallets or emails', async () => {
    const body = { seller: 'merchant@example.com', nominal_buyer: '0x39C3236A2F7FCE4Cc215a24fFb32aC48646b2288' };
    const { req, res } = createMocks({ method: 'POST', body });

    await handler(req as any, res as any);

    const options = proxyToService.mock.calls[0][2];
    expect(options.service).toBe('ap2');
    expect(options.path).toBe('/parties/resolve');
    expect(options.body).toEqual(body);
  });

  /** Same population as /settle: merchants and agent platforms with no Conduit session. */
  it('does not require a Conduit session', async () => {
    const { req, res } = createMocks({ method: 'POST', body: { seller: 'merchant@example.com' } });

    await handler(req as any, res as any);

    expect(proxyToService.mock.calls[0][2].requiresAuth).toBe(false);
  });

  it('forwards only the two party fields, nothing else a caller might attach', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: { seller: 'merchant@example.com', create: false, apiKey: 'nope' }
    });

    await handler(req as any, res as any);

    expect(proxyToService.mock.calls[0][2].body).toEqual({ seller: 'merchant@example.com', nominal_buyer: undefined });
  });

  it('refuses an empty request without asking ap2service', async () => {
    const { req, res } = createMocks({ method: 'POST', body: {} });

    await handler(req as any, res as any);

    expect(res._getStatusCode()).toBe(400);
    expect(proxyToService).not.toHaveBeenCalled();
  });

  it('is POST only', async () => {
    const { req, res } = createMocks({ method: 'GET' });

    await handler(req as any, res as any);

    expect(res._getStatusCode()).toBe(405);
  });
});
