/**
 * The LP's withdraw and reserve release are sent by chainservice: both are permissionless on the
 * vault and let the caller choose nothing, so the platform pays and the LP signs nothing.
 *
 * These routes only carry the vault's address. What is worth testing is that nothing else a
 * caller sends reaches chainservice, and that they answer only POST.
 */

import { createMocks } from 'node-mocks-http';
import withdrawOffer from '@/pages/api/chain/marketplace/withdraw-offer';
import releaseHoldback from '@/pages/api/chain/marketplace/release-holdback';
import * as serviceProxy from '@/lib/server/serviceProxy';

jest.mock('@/lib/server/serviceProxy', () => ({
  ...jest.requireActual('@/lib/server/serviceProxy'),
  proxyToService: jest.fn()
}));

const proxyToService = serviceProxy.proxyToService as jest.Mock;
const VAULT = '0x66a7000000000000000000000000000000cb56ab';

describe.each([
  ['withdraw-offer', withdrawOffer],
  ['release-holdback', releaseHoldback]
] as const)('POST /api/chain/marketplace/%s', (route, handler) => {
  beforeEach(() => proxyToService.mockReset());

  it("carries only the vault's address to chainservice's own relay", async () => {
    const { req, res } = createMocks({ method: 'POST', body: { vaultAddress: VAULT, to: '0xattacker', amount: '1' } });

    await handler(req as any, res as any);

    expect(proxyToService).toHaveBeenCalledTimes(1);
    const options = proxyToService.mock.calls[0][2];
    expect(options).toMatchObject({ service: 'chain', path: `/api/chain/marketplace/${route}`, method: 'POST' });
    expect(options.body).toEqual({ vaultAddress: VAULT });
  });

  it('answers only POST', async () => {
    const { req, res } = createMocks({ method: 'GET' });

    await handler(req as any, res as any);

    expect(res._getStatusCode()).toBe(405);
    expect(proxyToService).not.toHaveBeenCalled();
  });
});
