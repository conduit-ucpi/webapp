/**
 * The authorization proxy: carries a payer's transfer to ap2service to be built, decides nothing.
 */

import { createMocks } from 'node-mocks-http';
import handler from '@/pages/api/ap2/authorization';
import * as serviceProxy from '@/lib/server/serviceProxy';

jest.mock('@/lib/server/serviceProxy', () => ({
  ...jest.requireActual('@/lib/server/serviceProxy'),
  proxyToService: jest.fn()
}));

const proxyToService = serviceProxy.proxyToService as jest.Mock;

const BODY = {
  token_address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  payer: '0x39C3236A2F7FCE4Cc215a24fFb32aC48646b2288',
  to: '0x7b0e8Fa36cF4E8AE5416F759692759ae7745F51B',
  value: 1000000
};

describe('POST /api/ap2/authorization', () => {
  beforeEach(() => proxyToService.mockReset());

  it('carries the transfer to ap2service, unauthenticated like /settle', async () => {
    const { req, res } = createMocks({ method: 'POST', body: BODY });

    await handler(req as any, res as any);

    const options = proxyToService.mock.calls[0][2];
    expect(options.service).toBe('ap2');
    expect(options.path).toBe('/authorization');
    expect(options.requiresAuth).toBe(false);
    expect(options.body).toEqual({ ...BODY, valid_for_seconds: undefined });
  });

  it('forwards only the fields the endpoint takes', async () => {
    const { req, res } = createMocks({ method: 'POST', body: { ...BODY, signature: '0xnope' } });

    await handler(req as any, res as any);

    expect(proxyToService.mock.calls[0][2].body).not.toHaveProperty('signature');
  });

  it('names the missing field without asking ap2service', async () => {
    const { req, res } = createMocks({ method: 'POST', body: { ...BODY, to: undefined } });

    await handler(req as any, res as any);

    expect(res._getStatusCode()).toBe(400);
    expect(JSON.parse(res._getData()).error).toContain('to');
    expect(proxyToService).not.toHaveBeenCalled();
  });

  it('is POST only', async () => {
    const { req, res } = createMocks({ method: 'GET' });

    await handler(req as any, res as any);

    expect(res._getStatusCode()).toBe(405);
  });
});
