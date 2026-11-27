/**
 * A shop's payout settings are its owner's alone. Until 2026-11-20 the endpoint had no check:
 * anyone naming a shop could point its payouts at their own wallet.
 */
import { createMocks } from 'node-mocks-http';
import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '@/pages/api/shopify/settings';

const getMerchantSettings = jest.fn();
const saveMerchantSettings = jest.fn();
jest.mock('@/lib/mongodb', () => ({
  getMerchantSettings: (...args: unknown[]) => getMerchantSettings(...args),
  saveMerchantSettings: (...args: unknown[]) => saveMerchantSettings(...args),
}));

const fetchIdentity = jest.fn();
jest.mock('@/lib/server/coinbaseCdp', () => ({ fetchIdentity: (...args: unknown[]) => fetchIdentity(...args) }));

const SHOP = 'a-real-shop.myshopify.com';
const OWNER = { userId: 'owner-1', walletAddress: '0x1111111111111111111111111111111111111111' };
const STRANGER = { userId: 'stranger-2', walletAddress: '0x2222222222222222222222222222222222222222' };
const THEIR_WALLET = '0x54b8000000000000000000000000000000000a00';

const stored = (over: Record<string, unknown> = {}) => ({
  shop: SHOP,
  walletAddress: OWNER.walletAddress,
  payoutDelayDays: 14,
  isActive: true,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  accessToken: 'shpat_never_leaves_the_server',
  ownerUserId: OWNER.userId,
  ...over,
});

async function call(method: 'GET' | 'POST' | 'PUT' | 'DELETE', opts: { signedIn?: boolean; body?: unknown; shop?: string | null } = {}) {
  const { req, res } = createMocks({
    method,
    query: opts.shop === null ? {} : { shop: opts.shop ?? SHOP },
    headers: opts.signedIn === false ? {} : { cookie: 'AUTH-TOKEN=a-token' },
    body: opts.body as any,
  });
  await handler(req as unknown as NextApiRequest, res as unknown as NextApiResponse);
  return { status: res._getStatusCode(), body: res._getData() ? JSON.parse(res._getData()) : null };
}

const change = { walletAddress: THEIR_WALLET, payoutDelayDays: 3 };

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  getMerchantSettings.mockResolvedValue(stored());
  saveMerchantSettings.mockResolvedValue(undefined);
  fetchIdentity.mockResolvedValue(OWNER);
});
afterEach(() => jest.restoreAllMocks());

describe('who may open a shop\'s settings', () => {
  it.each(['GET', 'POST', 'PUT'] as const)('%s with no session is refused before the shop is even looked up', async (method) => {
    const answer = await call(method, { signedIn: false, body: change });

    expect(answer.status).toBe(401);
    expect(fetchIdentity).not.toHaveBeenCalled();
    expect(getMerchantSettings).not.toHaveBeenCalled();
    expect(saveMerchantSettings).not.toHaveBeenCalled();
  });

  it('a token userservice does not recognise is no session at all', async () => {
    fetchIdentity.mockResolvedValue(null);

    expect((await call('POST', { body: change })).status).toBe(401);
    expect(saveMerchantSettings).not.toHaveBeenCalled();
  });

  it.each(['GET', 'POST', 'PUT'] as const)('%s by a signed-in user who is not the owner is refused, and nothing is shown or saved', async (method) => {
    fetchIdentity.mockResolvedValue(STRANGER);

    const answer = await call(method, { body: change });

    expect(answer.status).toBe(403);
    expect(JSON.stringify(answer.body)).not.toContain(OWNER.walletAddress);
    expect(saveMerchantSettings).not.toHaveBeenCalled();
  });

  it('the owner reads the settings, without the Shopify token or the owner id', async () => {
    const answer = await call('GET');

    expect(answer.status).toBe(200);
    expect(answer.body).toMatchObject({ shop: SHOP, walletAddress: OWNER.walletAddress, payoutDelayDays: 14 });
    expect(answer.body).not.toHaveProperty('accessToken');
    expect(answer.body).not.toHaveProperty('ownerUserId');
  });

  it('the owner changes them, and stays the owner', async () => {
    const answer = await call('POST', { body: change });

    expect(answer.status).toBe(200);
    expect(saveMerchantSettings).toHaveBeenCalledWith(expect.objectContaining({ ...change, ownerUserId: OWNER.userId, accessToken: 'shpat_never_leaves_the_server' }));
    expect(answer.body).not.toHaveProperty('accessToken');
  });
});

describe('a record with no owner', () => {
  beforeEach(() => getMerchantSettings.mockResolvedValue(stored({ ownerUserId: undefined, walletAddress: '' })));

  it.each(['GET', 'POST', 'PUT'] as const)('%s: nobody may open it or claim it, however signed in', async (method) => {
    fetchIdentity.mockResolvedValue(STRANGER);

    const answer = await call(method, { body: { ...change, ownerUserId: STRANGER.userId } });

    expect(answer.status).toBe(403);
    expect(answer.body.error).toMatch(/Reconnect this shop/);
    expect(saveMerchantSettings).not.toHaveBeenCalled();
  });
});

describe('what is asked for', () => {
  it('a shop that was never connected is not found', async () => {
    getMerchantSettings.mockResolvedValue(null);
    expect((await call('GET')).status).toBe(404);
    expect((await call('POST', { body: change })).status).toBe(404);
  });

  it.each([
    ['no wallet', { payoutDelayDays: 3 }],
    ['a wallet that is not an address', { walletAddress: '0x123', payoutDelayDays: 3 }],
    ['a wallet that is not a string', { walletAddress: { $ne: '' }, payoutDelayDays: 3 }],
    ['a delay out of range', { walletAddress: THEIR_WALLET, payoutDelayDays: 31 }],
    ['a delay that is not a number', { walletAddress: THEIR_WALLET, payoutDelayDays: '14' }],
  ])('%s is refused and nothing is saved', async (_what, body) => {
    expect((await call('POST', { body })).status).toBe(400);
    expect(saveMerchantSettings).not.toHaveBeenCalled();
  });

  it('needs a shop, and only reads or writes', async () => {
    expect((await call('GET', { shop: null })).status).toBe(400);
    expect((await call('DELETE')).status).toBe(405);
  });
});
