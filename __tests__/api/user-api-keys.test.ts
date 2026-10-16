/**
 * The merchant API-key proxies: the user's session goes to userservice, and userservice's answer
 * (status and body, including the once-only `key`) comes back untouched.
 */
import { createMocks } from 'node-mocks-http';
import listOrCreate from '@/pages/api/user/api-keys';
import revoke from '@/pages/api/user/api-keys/[id]';

const fetchMock = jest.fn();

const upstream = (status: number, body?: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => (body === undefined ? '' : JSON.stringify(body)),
});

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as any;
  process.env.USER_SERVICE_URL = 'http://web3userservice:8977';
});

describe('/api/user/api-keys', () => {
  it('lists keys with the user’s cookie and bearer token forwarded', async () => {
    const keys = [{ id: 'k1', label: 'Bot', prefix: 'sd_live_Ab3x', createdAt: 1759276800, lastUsedAt: null }];
    fetchMock.mockResolvedValue(upstream(200, keys));
    const { req, res } = createMocks({ method: 'GET', headers: { cookie: 'AUTH-TOKEN=tok; other=1' } });

    await listOrCreate(req as any, res as any);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://web3userservice:8977/api/user/api-keys');
    expect(init.method).toBe('GET');
    expect(init.headers.Cookie).toBe('AUTH-TOKEN=tok; other=1');
    expect(init.headers.Authorization).toBe('Bearer tok');
    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toEqual(keys);
  });

  it('creates a key with only the label, passing the 201 and the full key through', async () => {
    const created = { id: 'k2', label: 'WhatsApp', prefix: 'sd_live_Zz9q', createdAt: 1759363200, lastUsedAt: null, key: 'sd_live_Zz9qSECRET' };
    fetchMock.mockResolvedValue(upstream(201, created));
    const { req, res } = createMocks({
      method: 'POST',
      headers: { authorization: 'Bearer farcaster-tok' },
      body: { label: 'WhatsApp', userId: 'someone-else' },
    });

    await listOrCreate(req as any, res as any);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://web3userservice:8977/api/user/api-keys');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer farcaster-tok');
    expect(JSON.parse(init.body)).toEqual({ label: 'WhatsApp' });
    expect(res._getStatusCode()).toBe(201);
    expect(JSON.parse(res._getData())).toEqual(created);
  });

  it.each([
    [400, { error: 'User has no wallet yet' }],
    [401, { error: 'Unauthorized' }],
    [409, { error: 'Too many active keys' }],
  ])('passes userservice’s %s through with its body', async (status, body) => {
    fetchMock.mockResolvedValue(upstream(status, body));
    const { req, res } = createMocks({ method: 'POST', headers: { cookie: 'AUTH-TOKEN=tok' }, body: { label: 'x' } });

    await listOrCreate(req as any, res as any);

    expect(res._getStatusCode()).toBe(status);
    expect(JSON.parse(res._getData())).toEqual(body);
  });

  it('passes userservice’s 401 through for an sd_live_ API key used as the bearer', async () => {
    fetchMock.mockResolvedValue(upstream(401, { error: 'Unauthorized' }));
    const { req, res } = createMocks({ method: 'GET', headers: { authorization: 'Bearer sd_live_Ab3xSECRET' } });

    await listOrCreate(req as any, res as any);

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer sd_live_Ab3xSECRET');
    expect(res._getStatusCode()).toBe(401);
  });

  it('refuses a visitor with no session without asking userservice', async () => {
    const { req, res } = createMocks({ method: 'GET' });

    await listOrCreate(req as any, res as any);

    expect(res._getStatusCode()).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses other methods', async () => {
    const { req, res } = createMocks({ method: 'PUT', headers: { cookie: 'AUTH-TOKEN=tok' } });

    await listOrCreate(req as any, res as any);

    expect(res._getStatusCode()).toBe(405);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('/api/user/api-keys/[id]', () => {
  it('revokes with DELETE, no body, credentials forwarded, and passes the empty 204 through', async () => {
    fetchMock.mockResolvedValue(upstream(204));
    const { req, res } = createMocks({ method: 'DELETE', query: { id: 'k1' }, headers: { cookie: 'AUTH-TOKEN=tok' } });

    await revoke(req as any, res as any);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://web3userservice:8977/api/user/api-keys/k1');
    expect(init.method).toBe('DELETE');
    expect(init.body).toBeUndefined();
    expect(init.headers.Cookie).toBe('AUTH-TOKEN=tok');
    expect(init.headers.Authorization).toBe('Bearer tok');
    expect(res._getStatusCode()).toBe(204);
    expect(res._getData()).toBe('');
  });

  it('passes a 404 through', async () => {
    fetchMock.mockResolvedValue(upstream(404, { error: 'Not found' }));
    const { req, res } = createMocks({ method: 'DELETE', query: { id: 'nope' }, headers: { cookie: 'AUTH-TOKEN=tok' } });

    await revoke(req as any, res as any);

    expect(res._getStatusCode()).toBe(404);
  });

  it.each(['../admin', 'a/b', ''])('refuses an id that is not one (%p)', async (id) => {
    const { req, res } = createMocks({ method: 'DELETE', query: { id }, headers: { cookie: 'AUTH-TOKEN=tok' } });

    await revoke(req as any, res as any);

    expect(res._getStatusCode()).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses anything but DELETE', async () => {
    const { req, res } = createMocks({ method: 'GET', query: { id: 'k1' }, headers: { cookie: 'AUTH-TOKEN=tok' } });

    await revoke(req as any, res as any);

    expect(res._getStatusCode()).toBe(405);
  });
});
