/**
 * Three routes someone probing the live site got an answer from, 14-19 Nov 2026.
 *
 * - /api/users/search and /api/users/fid/<n> spent the Neynar key for anyone on the internet.
 * - /api/contracts/admin/database crashed on contractservice's bodiless refusal, so each refused
 *   stranger was logged as a 500 with a stack trace.
 * - /api/admin/cache/invalidate forwarded any signed-in user's request to an admin function.
 *   Nothing called it, so it is gone.
 */
import fs from 'fs';
import path from 'path';
import { createMocks } from 'node-mocks-http';
import type { NextApiRequest, NextApiResponse } from 'next';
// The session check lives beside the Coinbase client, whose SDK jest cannot load.
jest.mock('@coinbase/cdp-sdk/auth', () => ({ generateJwt: jest.fn() }));

import search from '@/pages/api/users/search';
import byFid from '@/pages/api/users/fid/[fid]';
import adminDatabase from '@/pages/api/contracts/admin/database';

const fetchMock = jest.fn();
const answer = (status: number, body: string) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => JSON.parse(body),
  text: async () => body,
});

/** userservice knows the session `good` and nobody else; Neynar answers whoever gets that far. */
function services() {
  fetchMock.mockImplementation(async (url: string, init?: { headers?: Record<string, string> }) => {
    if (url.includes('/api/user/identity')) {
      return init?.headers?.Authorization === 'Bearer good' ? answer(200, '{"userId":"u1"}') : answer(401, '');
    }
    if (url.includes('/user/search')) return answer(200, '{"result":{"users":[{"fid":70,"username":"a"}]}}');
    if (url.includes('/user/bulk')) return answer(200, '{"users":[{"fid":1,"username":"farcaster"}]}');
    throw new Error(`unexpected fetch ${url}`);
  });
}
const neynarCalls = () => fetchMock.mock.calls.filter(([url]) => String(url).startsWith('https://neynar.test'));

async function call(
  handler: (req: NextApiRequest, res: NextApiResponse) => unknown,
  options: { method?: 'GET' | 'POST'; query?: Record<string, string>; cookie?: string; body?: unknown },
) {
  const { req, res } = createMocks({
    method: options.method ?? 'GET',
    query: options.query,
    body: options.body as never,
    headers: options.cookie ? { cookie: options.cookie } : {},
  });
  await handler(req as unknown as NextApiRequest, res as unknown as NextApiResponse);
  return res;
}

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
  process.env.USER_SERVICE_URL = 'http://userservice.test';
  process.env.CONTRACT_SERVICE_URL = 'http://contractservice.test';
  process.env.NEYNAR_API_KEY = 'key';
  process.env.NEYNAR_API_URL = 'https://neynar.test';
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('the Farcaster lookups', () => {
  it.each([
    ['search', search, { q: 'a' }],
    ['by id', byFid, { fid: '1' }],
  ])('%s: refuses a caller with no session, and Neynar is never asked', async (_name, handler, query) => {
    services();
    const res = await call(handler, { query });
    expect(res._getStatusCode()).toBe(401);
    expect(neynarCalls()).toHaveLength(0);
  });

  it.each([
    ['search', search, { q: 'a' }],
    ['by id', byFid, { fid: '1' }],
  ])('%s: refuses a token userservice does not recognise', async (_name, handler, query) => {
    services();
    const res = await call(handler, { query, cookie: 'AUTH-TOKEN=made-up' });
    expect(res._getStatusCode()).toBe(401);
    expect(neynarCalls()).toHaveLength(0);
  });

  it('search answers a signed-in user', async () => {
    services();
    const res = await call(search, { query: { q: 'a' }, cookie: 'AUTH-TOKEN=good' });
    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData()).users[0].username).toBe('a');
  });

  it('by id answers a signed-in user', async () => {
    services();
    const res = await call(byFid, { query: { fid: '1' }, cookie: 'AUTH-TOKEN=good' });
    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData()).user.username).toBe('farcaster');
  });
});

describe('the admin database proxy', () => {
  it("passes on contractservice's refusal, which has no body, without crashing", async () => {
    fetchMock.mockResolvedValue(answer(403, ''));
    const res = await call(adminDatabase, { method: 'POST', body: { collection: 'contracts' } });
    expect(res._getStatusCode()).toBe(403);
    expect(console.error).not.toHaveBeenCalled();
  });

  it('passes on a refusal that does have a body', async () => {
    fetchMock.mockResolvedValue(answer(400, '{"message":"bad query"}'));
    const res = await call(adminDatabase, { method: 'POST', body: {} });
    expect(res._getStatusCode()).toBe(400);
    expect(JSON.parse(res._getData())).toEqual({ message: 'bad query' });
  });

  it('passes on an answer', async () => {
    fetchMock.mockResolvedValue(answer(200, '{"rows":[1]}'));
    const res = await call(adminDatabase, { method: 'POST', body: {} });
    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toEqual({ rows: [1] });
  });

  it('does not tell the caller why it failed when the service cannot be reached', async () => {
    fetchMock.mockRejectedValue(new Error('connect ECONNREFUSED 172.18.0.5:8080'));
    const res = await call(adminDatabase, { method: 'POST', body: {} });
    expect(res._getStatusCode()).toBe(500);
    expect(JSON.stringify(JSON.parse(res._getData()))).not.toContain('172.18');
  });
});

describe('/api/admin/cache/invalidate', () => {
  it('no longer exists', () => {
    expect(fs.existsSync(path.join(process.cwd(), 'pages/api/admin/cache/invalidate.ts'))).toBe(false);
  });
});
