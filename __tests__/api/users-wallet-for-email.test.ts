/**
 * Email → wallet for a tiebreaker nominated by email: signed in, the webapp's own userservice key,
 * nothing of the visitor's request forwarded.
 */

import { createMocks } from 'node-mocks-http';
import handler from '@/pages/api/users/wallet-for-email';
import { fetchIdentity } from '@/lib/server/coinbaseCdp';

jest.mock('@/lib/server/coinbaseCdp', () => ({ fetchIdentity: jest.fn() }));

const identity = fetchIdentity as jest.Mock;
const fetchMock = jest.fn();
const WALLET = '0xc9D0602A87E55116F633b1A1F95D083Eb115f942';

const signedIn = (body: unknown = { email: 'Mediator@Example.com ' }) =>
  createMocks({
    method: 'POST',
    headers: { cookie: 'AUTH-TOKEN=tok', 'x-forwarded-for': '203.0.113.7' },
    body
  });

beforeEach(() => {
  identity.mockReset().mockResolvedValue({ userId: 'u1' });
  fetchMock.mockReset();
  global.fetch = fetchMock as any;
  process.env.USER_SERVICE_URL = 'http://web3userservice:8977/';
  process.env.TO_USERSERVICE_API_KEY = 'to-user-key';
});

afterAll(() => {
  delete process.env.TO_USERSERVICE_API_KEY;
});

describe('POST /api/users/wallet-for-email', () => {
  it('asks userservice with its own key, creating a wallet when asked to, and forwards nothing else', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ email: 'mediator@example.com', walletAddress: WALLET, source: 'privy' }) });
    const { req, res } = signedIn({ email: 'Mediator@Example.com ', create: true });

    await handler(req as any, res as any);

    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toEqual({ email: 'mediator@example.com', walletAddress: WALLET });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://web3userservice:8977/api/service/wallet-for-email?email=mediator%40example.com&create=true');
    // Exactly these headers: userservice 404s anything carrying a proxy header.
    expect(init.headers).toEqual({ 'Accept': 'application/json', 'X-API-Key': 'to-user-key' });
  });

  it('only looks up, never creates, unless create is exactly true: the live preview must not make wallets', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404, text: async () => '' });
    for (const body of [{ email: 'a@b.com' }, { email: 'a@b.com', create: 'true' }]) {
      fetchMock.mockClear();
      const { req, res } = signedIn(body);

      await handler(req as any, res as any);

      expect(fetchMock.mock.calls[0][0]).toContain('&create=false');
      expect(res._getStatusCode()).toBe(404);
    }
  });

  it('refuses a visitor without a session userservice recognises, before any lookup', async () => {
    identity.mockResolvedValue(null);
    const { req, res } = signedIn();

    await handler(req as any, res as any);

    expect(res._getStatusCode()).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses a visitor with no token at all', async () => {
    const { req, res } = createMocks({ method: 'POST', body: { email: 'a@b.com' } });

    await handler(req as any, res as any);

    expect(res._getStatusCode()).toBe(401);
    expect(identity).not.toHaveBeenCalled();
  });

  it('refuses something that is not an email without asking userservice', async () => {
    const { req, res } = signedIn({ email: '0x1234' });

    await handler(req as any, res as any);

    expect(res._getStatusCode()).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('is off, and says so, without its key', async () => {
    delete process.env.TO_USERSERVICE_API_KEY;
    const { req, res } = signedIn();

    await handler(req as any, res as any);

    expect(res._getStatusCode()).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not pass userservice's own errors through: a key mismatch is a 502 to the visitor", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401, text: async () => '' });
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { req, res } = signedIn();

    await handler(req as any, res as any);

    expect(res._getStatusCode()).toBe(502);
    expect(errors).toHaveBeenCalled();
    errors.mockRestore();
  });

  it('is POST only', async () => {
    const { req, res } = createMocks({ method: 'GET' });

    await handler(req as any, res as any);

    expect(res._getStatusCode()).toBe(405);
  });
});
