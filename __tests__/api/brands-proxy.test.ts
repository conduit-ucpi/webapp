/**
 * @jest-environment node
 *
 * The /api/brands proxy to the white-label service. Each environment's webapp reaches its own
 * service through WHITELABEL_SERVICE_URL; what these pin is what crosses in each direction.
 */
import { createMocks as createTypedMocks } from 'node-mocks-http';
import handler from '@/pages/api/brands/[[...path]]';

// The repo's local node-mocks-http typings omit array queries, req.send and res._getBuffer.
const createMocks = (options: Record<string, unknown>): { req: any; res: any } => createTypedMocks(options as any) as any;

const fetchMock = jest.fn();
const upstream = (status: number, body = '', headers: Record<string, string> = {}) =>
  new Response(status === 204 || status === 304 ? null : body, { status, headers });

describe('/api/brands proxy', () => {
  const env = process.env.WHITELABEL_SERVICE_URL;
  beforeEach(() => {
    process.env.WHITELABEL_SERVICE_URL = 'http://whitelabelservice:8985/';
    process.env.X_API_KEY = 'app-key';
    global.fetch = fetchMock as any;
    fetchMock.mockReset();
  });
  afterAll(() => {
    process.env.WHITELABEL_SERVICE_URL = env;
  });

  it('forwards a brand read to the configured service, with its caching headers', async () => {
    fetchMock.mockResolvedValue(
      upstream(200, '{"version":1}', { 'content-type': 'application/json', etag: '"abc"', 'cache-control': 'max-age=60, public' })
    );
    const { req, res } = createMocks({
      method: 'GET',
      query: { path: ['cobro'] },
      headers: { cookie: 'session=secret', 'if-none-match': '"old"' },
    });

    await handler(req as any, res as any);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://whitelabelservice:8985/api/brands/cobro');
    expect(init.headers).toEqual({ 'if-none-match': '"old"' });
    expect(res._getStatusCode()).toBe(200);
    expect(res.getHeader('etag')).toBe('"abc"');
    expect(res.getHeader('cache-control')).toBe('max-age=60, public');
  });

  it('never sends the session, nor adds this app’s own API key', async () => {
    fetchMock.mockResolvedValue(upstream(200, '{}'));
    const { req, res } = createMocks({ method: 'GET', query: { path: ['cobro'] }, headers: { cookie: 'session=secret' } });

    await handler(req as any, res as any);

    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers.cookie).toBeUndefined();
    expect(headers['x-api-key']).toBeUndefined();
  });

  it('passes an operator’s write through with their key and the body untouched', async () => {
    fetchMock.mockResolvedValue(upstream(200, '{"version":2}'));
    const { req, res } = createMocks({
      method: 'PUT',
      query: { path: ['cobro'] },
      headers: { 'content-type': 'application/json', 'x-api-key': 'operator-key' },
    });

    const done = handler(req as any, res as any);
    req.send('{"id":"cobro","name":"COBRO"}');
    await done;

    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe('PUT');
    expect(init.headers['x-api-key']).toBe('operator-key');
    expect(Buffer.from(init.body).toString()).toBe('{"id":"cobro","name":"COBRO"}');
  });

  it('carries asset bytes and the headers that keep them safe', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    fetchMock.mockResolvedValue(
      new Response(png, {
        status: 200,
        headers: {
          'content-type': 'image/png',
          'content-security-policy': "default-src 'none'; sandbox",
          'x-content-type-options': 'nosniff',
        },
      })
    );
    const { req, res } = createMocks({ method: 'GET', query: { path: ['cobro', 'assets', '65f0c0ffee0000000000abcd'] } });

    await handler(req as any, res as any);

    expect(fetchMock.mock.calls[0][0]).toBe('http://whitelabelservice:8985/api/brands/cobro/assets/65f0c0ffee0000000000abcd');
    expect(res.getHeader('content-security-policy')).toContain('sandbox');
    expect(res.getHeader('x-content-type-options')).toBe('nosniff');
    expect(Buffer.compare(res._getBuffer(), png)).toBe(0);
  });

  it('reaches the admin list with no path', async () => {
    fetchMock.mockResolvedValue(upstream(200, '[]'));
    const { req, res } = createMocks({ method: 'GET', query: {} });

    await handler(req as any, res as any);

    expect(fetchMock.mock.calls[0][0]).toBe('http://whitelabelservice:8985/api/brands');
  });

  it('refuses paths that could leave /api/brands', async () => {
    const { req, res } = createMocks({ method: 'GET', query: { path: ['..', 'admin'] } });

    await handler(req as any, res as any);

    expect(res._getStatusCode()).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('answers 503 when unconfigured, which the page treats as "keep the snapshot"', async () => {
    delete process.env.WHITELABEL_SERVICE_URL;
    const { req, res } = createMocks({ method: 'GET', query: { path: ['cobro'] } });

    await handler(req as any, res as any);

    expect(res._getStatusCode()).toBe(503);
  });

  it('passes a 304 through with no body', async () => {
    fetchMock.mockResolvedValue(upstream(304, '', { etag: '"abc"' }));
    const { req, res } = createMocks({ method: 'GET', query: { path: ['cobro'] }, headers: { 'if-none-match': '"abc"' } });

    await handler(req as any, res as any);

    expect(res._getStatusCode()).toBe(304);
  });
});
