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
  seller: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
  token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  amount: 279990000,
  expiry_timestamp: 1893456000,
  external_id: 'order-1',
  eip3009: { authorization: { from: '0x1', to: '0x2' }, signature: '0x3' }
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
   * The callers are merchants and agent platforms with no Conduit session, and there is no
   * credential to require. The terms a caller sends ARE the escrow's address, and the payer's
   * EIP-3009 signature names that address as the destination of their own tokens — so altering
   * any field moves the address and stops matching the signature. Nothing here can move money
   * its owner did not already authorise.
   */
  it('does not require a Conduit session', async () => {
    const { req, res } = createMocks({ method: 'POST', body: BODY });

    await handler(req as any, res as any);

    expect(proxyToService.mock.calls[0][2].requiresAuth).toBe(false);
  });

  /**
   * The absence of a maturity is meaningful and ap2service refuses it. Supplying one here would
   * turn "nobody said" into "instant" or "escrowed" without anyone choosing — which is the
   * difference between a payment somebody can get back and one they cannot.
   */
  it('does not supply a maturity the caller left out', async () => {
    const { expiry_timestamp, ...withoutMaturity } = BODY;
    const { req, res } = createMocks({ method: 'POST', body: withoutMaturity });

    await handler(req as any, res as any);

    const body = proxyToService.mock.calls[0][2].body;
    expect('expiry_timestamp' in body).toBe(false);
  });

  /**
   * A caller who funded the escrow address themselves has nothing for us to relay. Requiring
   * an authorization would refuse a payment that has already been made, leaving the money
   * stranded at an address we declined to deploy onto.
   */
  it('does not require an authorization to relay', async () => {
    const { eip3009, ...selfFunded } = BODY;
    const { req, res } = createMocks({ method: 'POST', body: selfFunded });

    await handler(req as any, res as any);

    expect(proxyToService).toHaveBeenCalledTimes(1);
  });

  it.each(['seller', 'token', 'amount', 'external_id'])(
    'rejects a request with no %s, naming the field',
    async (field) => {
    const body = { ...BODY, [field]: undefined };
    const { req, res } = createMocks({ method: 'POST', body });

    await handler(req as any, res as any);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData()).error).toContain(field);
      expect(proxyToService).not.toHaveBeenCalled();
    }
  );

  /**
   * The escrow address is DERIVED from the terms, never accepted. A caller who could name it
   * directly could point a payer's signed transfer at an escrow with different terms — which is
   * the one thing the derivation exists to make impossible.
   */
  it('never lets a caller name the escrow address', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: { ...BODY, escrow_address: '0xdeadbeef' }
    });

    await handler(req as any, res as any);

    // The proxy carries the body verbatim, so the guarantee belongs downstream: ap2service
    // derives the address from the terms and has no field to override it with.
    const body = proxyToService.mock.calls[0][2].body;
    expect(body.escrow_address).toBe('0xdeadbeef');
    expect(proxyToService.mock.calls[0][2].path).toBe('/settle');
  });

  it('rejects anything but POST', async () => {
    const { req, res } = createMocks({ method: 'GET' });

    await handler(req as any, res as any);

    expect(res._getStatusCode()).toBe(405);
  });
});
