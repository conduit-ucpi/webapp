/**
 * The three admin routes that used to forward anything they were sent and leave the refusing to
 * the service behind them. Each now asks userservice who is calling before it touches a service.
 */
import { createMocks } from 'node-mocks-http';
import type { NextApiRequest, NextApiResponse } from 'next';
import database from '@/pages/api/contracts/admin/database';
import resolve from '@/pages/api/admin/contracts/[id]/resolve';
import notes from '@/pages/api/admin/contracts/[id]/notes';

const ID = '6b0045c0c09dcd0cc64d4f6a';
const ESCROW = '0x56420074961EE301A21343596c40345256E2D1c8';

const routes = [
  { name: 'the unredacted contract database', handler: database, method: 'POST' as const, query: {}, body: { createdTimestampFrom: 1, createdTimestampTo: 4102444800000 } },
  { name: 'resolving a dispute', handler: resolve, method: 'POST' as const, query: { id: ID }, body: { buyerPercentage: 100, sellerPercentage: 0, chainAddress: ESCROW } },
  { name: 'reading admin notes', handler: notes, method: 'GET' as const, query: { id: ID }, body: undefined },
  { name: 'adding an admin note', handler: notes, method: 'POST' as const, query: { id: ID }, body: { content: 'x' } },
];

const fetchMock = jest.fn();
const calledServices = () => fetchMock.mock.calls.map(([url]) => String(url)).filter((url) => !url.includes('/api/user/identity'));

function userserviceSays(identity: { userType: string } | null) {
  fetchMock.mockImplementation(async (url: string) => {
    if (String(url).includes('/api/user/identity')) {
      return identity ? { ok: true, status: 200, json: async () => identity } : { ok: false, status: 401, json: async () => ({}) };
    }
    return { ok: true, status: 200, json: async () => ({ success: true, contracts: [] }), text: async () => '{}' };
  });
}

async function call(route: (typeof routes)[number], signedIn: boolean) {
  const { req, res } = createMocks({
    method: route.method,
    query: route.query as Record<string, string>,
    body: route.body as any,
    headers: signedIn ? { cookie: 'AUTH-TOKEN=a-token' } : {},
  });
  await route.handler(req as unknown as NextApiRequest, res as unknown as NextApiResponse);
  return res._getStatusCode();
}

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = fetchMock as any;
  process.env.USER_SERVICE_URL = 'http://userservice';
  process.env.CONTRACT_SERVICE_URL = 'http://contractservice';
  process.env.CHAIN_SERVICE_URL = 'http://chainservice';
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe.each(routes)('$name', (route) => {
  it('with no session is refused, and nothing at all is asked of any service', async () => {
    userserviceSays({ userType: 'admin' });

    expect(await call(route, false)).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('with a token userservice does not recognise is refused before the service is reached', async () => {
    userserviceSays(null);

    expect(await call(route, true)).toBe(401);
    expect(calledServices()).toEqual([]);
  });

  it('by a signed-in user who is not an admin is refused before the service is reached', async () => {
    userserviceSays({ userType: 'normal' });

    expect(await call(route, true)).toBe(403);
    expect(calledServices()).toEqual([]);
  });

  it('by an admin goes through to the service', async () => {
    userserviceSays({ userType: 'admin' });

    expect(await call(route, true)).toBeLessThan(300);
    expect(calledServices()).toHaveLength(1);
  });
});
