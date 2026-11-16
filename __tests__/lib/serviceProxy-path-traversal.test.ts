/**
 * A caller-supplied id or address goes into an upstream URL as one path segment and nothing more.
 *
 * On 2026-11-16 a signed-in caller asked for the reserves of seller `../../contracts#`. Next
 * decoded it, the route interpolated it, and fetch() resolved it to GET /api/contracts on
 * contractservice with the webapp's service key attached. These are the exact values they sent.
 */

import { createMocks } from 'node-mocks-http';
import { isPathSegment, pathEscapes } from '@/lib/server/serviceProxy';
import reserves from '@/pages/api/marketplace/sellers/[sellerAddress]/reserves';
import lpOffers from '@/pages/api/marketplace/lps/[lpAddress]/offers';
import escrowOffers from '@/pages/api/marketplace/escrows/[escrowContract]/offers';
import walletContracts from '@/pages/api/chain/contracts/[walletAddress]';
import chainContract from '@/pages/api/chain/contract/[contractAddress]';
import arbiter from '@/pages/api/chain/contract/[contractAddress]/arbiter';
import dispute from '@/pages/api/contracts/[id]/dispute';
import notes from '@/pages/api/admin/contracts/[id]/notes';
import resolve from '@/pages/api/admin/contracts/[id]/resolve';

// What Next hands a handler after decoding %2F, %23 and %3F.
const SENT = [
  '../../contracts#',
  '../../contracts/user#',
  '../../service/payment-requests#',
  '../../contracts/admin/database?createdTimestampFrom=1&createdTimestampTo=4102444800000#',
  '../../api/chain/keys',
  '..',
  '%2e%2e',
  'a/b',
  'a?b=c',
  'a#b'
];

const REAL = [
  '0x7626D4c1bA2E1a5c0E1E3c1A7f6b9D2e4F5aF20f',
  '6af90863a1c5f839cca35f47',
  'mcp-3e53dd9c-ee62-42f4-b641-b6dc6aaada3f',
  '11111111-1111-1111-1111-111111111111'
];

const WALLET = REAL[0];

describe('a value used as one path segment', () => {
  it.each(REAL)('accepts %s', value => expect(isPathSegment(value)).toBe(true));
  it.each(SENT)('refuses %s', value => expect(isPathSegment(value)).toBe(false));
  it('refuses blanks, arrays and over-long values', () => {
    expect(isPathSegment('')).toBe(false);
    expect(isPathSegment(['a'])).toBe(false);
    expect(isPathSegment(undefined)).toBe(false);
    expect(isPathSegment('a'.repeat(65))).toBe(false);
  });
});

describe('a finished upstream path', () => {
  it.each([
    '/api/marketplace/sellers/../../contracts',
    '/api/contracts/%2e%2e/x',
    '/api/contracts/%2E./x',
    '/api/contracts/./x',
    '/api/contracts/x#/reserves',
    '/api/contracts/x\\y',
    '/api/x?t=a#b'
  ])('%s would resolve elsewhere', path => expect(pathEscapes(path)).toBe(true));

  it.each([
    `/api/marketplace/sellers/${WALLET}/reserves`,
    '/api/marketplace/sellable?maxDaysToMaturity=30',
    '/api/email-verification/confirm?t=abc.def%2Fghi..jkl',
    '/requests?limit=50',
    '/api/user/api-keys/6af90863a1c5f839cca35f47',
    '/.well-known/x'
  ])('%s is left alone', path => expect(pathEscapes(path)).toBe(false));
});

describe('routes that put a caller value in an upstream path', () => {
  const fetchMock = jest.fn();
  const realFetch = global.fetch;

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => '[]', json: async () => [], headers: new Headers() });
    global.fetch = fetchMock as any;
    process.env.CONTRACT_SERVICE_URL = 'http://contractservice';
    process.env.CHAIN_SERVICE_URL = 'http://chainservice';
  });
  afterAll(() => { global.fetch = realFetch; });

  const signedIn = { cookie: 'AUTH-TOKEN=test-token' };
  const call = async (handler: any, method: string, query: Record<string, string>, body?: unknown) => {
    const { req, res } = createMocks({ method: method as any, query, body: body as any, headers: signedIn });
    await handler(req as any, res as any);
    return res;
  };

  const GETS: Array<[string, any, string]> = [
    ['seller reserves', reserves, 'sellerAddress'],
    ['LP offers', lpOffers, 'lpAddress'],
    ['escrow offers', escrowOffers, 'escrowContract'],
    ['wallet contracts', walletContracts, 'walletAddress'],
    ['chain contract', chainContract, 'contractAddress'],
    ['arbiter seat', arbiter, 'contractAddress'],
    ['admin notes', notes, 'id']
  ];

  describe.each(GETS)('%s', (_name, handler, param) => {
    it.each(SENT)('answers 400 to %s without calling the service', async value => {
      const res = await call(handler, 'GET', { [param]: value });
      expect(res._getStatusCode()).toBe(400);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('still forwards a real address, to the path it names', async () => {
      const res = await call(handler, 'GET', { [param]: WALLET });
      expect(res._getStatusCode()).not.toBe(400);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(new URL(fetchMock.mock.calls[0][0]).pathname).toContain(`/${WALLET}`);
    });
  });

  it.each(SENT)('a dispute on contract %s is refused', async value => {
    const res = await call(dispute, 'POST', { id: value }, { reason: 'late', refundPercent: 50 });
    expect(res._getStatusCode()).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(SENT)('a resolution naming chain address %s is refused', async value => {
    const res = await call(resolve, 'POST', { id: '6af90863a1c5f839cca35f47' }, {
      buyerPercentage: 50, sellerPercentage: 50, chainAddress: value
    });
    expect(res._getStatusCode()).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
