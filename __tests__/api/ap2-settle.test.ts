/**
 * The AP2 proxy routes.
 *
 * These exist to carry a request to ap2service and nothing else, so what is worth testing is
 * mostly what they must NOT do: verify anything, or supply a value the caller left out.
 */

import { createMocks } from 'node-mocks-http';
import handler from '@/pages/api/ap2/settle';
import * as serviceProxy from '@/lib/server/serviceProxy';

jest.mock('@/lib/server/serviceProxy', () => ({
  ...jest.requireActual('@/lib/server/serviceProxy'),
  proxyToService: jest.fn()
}));

const proxyToService = serviceProxy.proxyToService as jest.Mock;

const BODY = {
  mandate_chain: 'chain',
  payment_nonce: 'nonce',
  checkout_jwt_hash: 'hash',
  open_checkout_hash: 'open',
  eip3009: { authorization: { from: '0x1', to: '0x2' }, signature: '0x3' },
  seller: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
  contractserviceId: undefined,
  contractservice_id: '507f1f77bcf86cd799439011',
  dispute_window_seconds: 604800
};

describe('POST /api/ap2/settle', () => {
  beforeEach(() => proxyToService.mockReset());

  it('carries the request to ap2service unchanged', async () => {
    const { req, res } = createMocks({ method: 'POST', body: BODY });

    await handler(req as any, res as any);

    expect(proxyToService).toHaveBeenCalledTimes(1);
    const options = proxyToService.mock.calls[0][2];
    expect(options.service).toBe('ap2');
    expect(options.path).toBe('/settle');
    expect(options.body).toEqual(BODY);
  });

  /**
   * The callers are merchants and agent platforms with no Conduit session. The verified
   * mandate is the credential: signed, bound to one checkout, and carrying a nonce that cannot
   * be replayed.
   */
  it('does not require a Conduit session', async () => {
    const { req, res } = createMocks({ method: 'POST', body: BODY });

    await handler(req as any, res as any);

    expect(proxyToService.mock.calls[0][2].requiresAuth).toBe(false);
  });

  /**
   * The absence of a dispute window is meaningful and ap2service refuses it. Supplying one
   * here would turn "nobody said" into "instant" or "escrowed" without anyone choosing —
   * which is the difference between a payment somebody can get back and one they cannot.
   */
  it('does not supply a dispute window the caller left out', async () => {
    const { dispute_window_seconds, ...withoutWindow } = BODY;
    const { req, res } = createMocks({ method: 'POST', body: withoutWindow });

    await handler(req as any, res as any);

    const body = proxyToService.mock.calls[0][2].body;
    expect('dispute_window_seconds' in body).toBe(false);
  });

  it.each([
    'mandate_chain',
    'payment_nonce',
    'checkout_jwt_hash',
    'open_checkout_hash',
    'eip3009',
    'seller',
    'contractservice_id'
  ])('rejects a request with no %s, naming the field', async (field) => {
    const body = { ...BODY, [field]: undefined };
    const { req, res } = createMocks({ method: 'POST', body });

    await handler(req as any, res as any);

    expect(res._getStatusCode()).toBe(400);
    expect(JSON.parse(res._getData()).error).toContain(field);
    expect(proxyToService).not.toHaveBeenCalled();
  });

  it('rejects anything but POST', async () => {
    const { req, res } = createMocks({ method: 'GET' });

    await handler(req as any, res as any);

    expect(res._getStatusCode()).toBe(405);
  });
});
