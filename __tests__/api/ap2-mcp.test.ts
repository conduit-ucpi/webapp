/**
 * /api/ap2/mcp passes through who is calling: the access code an MCP client was configured with
 * (or the pay page's session), and the public host it called, so the tools can hand both on.
 */
import { createMocks } from 'node-mocks-http';
import handler from '@/pages/api/ap2/mcp';

const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ status: 200, text: async () => '{}', headers: new Map([['content-type', 'application/json']]) });
  global.fetch = fetchMock as any;
  process.env.AP2_SERVICE_URL = 'http://ap2service:8984';
});

describe('POST /api/ap2/mcp', () => {
  it("forwards the caller's access code, cookies and public host", async () => {
    const { req, res } = createMocks({
      method: 'POST',
      headers: {
        authorization: 'Bearer sd_access_abc',
        cookie: 'AUTH-TOKEN=t; session=s',
        host: 'api.example.test',
        'x-forwarded-proto': 'https'
      },
      body: { jsonrpc: '2.0', id: 1, method: 'tools/list' }
    });

    await handler(req as any, res as any);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://ap2service:8984/mcp/');
    expect(init.headers.Authorization).toBe('Bearer sd_access_abc');
    expect(init.headers.Cookie).toBe('AUTH-TOKEN=t; session=s');
    expect(init.headers['X-Forwarded-Host']).toBe('api.example.test');
    expect(init.headers['X-Forwarded-Proto']).toBe('https');
  });

  it('sends no credential headers when the caller sent none', async () => {
    const { req, res } = createMocks({ method: 'POST', headers: { host: 'api.example.test' }, body: {} });

    await handler(req as any, res as any);

    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers.Authorization).toBeUndefined();
    expect(headers.Cookie).toBeUndefined();
    expect(headers.Origin).toBeUndefined();
  });

  /**
   * The MCP spec has the SERVER validate a browser's Origin. It can only do that if the proxy
   * passes the header on; stripped, every request looks like a non-browser client and a page
   * on any site could drive the endpoint through a signed-in visitor's cookies.
   */
  it("passes a browser's Origin on for the server to judge, and relays its refusal", async () => {
    fetchMock.mockResolvedValue({ status: 403, text: async () => 'Forbidden Origin', headers: new Map([['content-type', 'text/plain; charset=utf-8']]) });
    const { req, res } = createMocks({
      method: 'POST',
      headers: { host: 'api.example.test', origin: 'https://evil.example' },
      body: { jsonrpc: '2.0', id: 1, method: 'tools/list' }
    });

    await handler(req as any, res as any);

    expect(fetchMock.mock.calls[0][1].headers.Origin).toBe('https://evil.example');
    expect(res._getStatusCode()).toBe(403);
    expect(res._getData()).toBe('Forbidden Origin');
  });

  const CODE = 'sd_access_' + 'A'.repeat(43);

  /** Claude.ai and ChatGPT connectors only take an address, so the code can ride in it. */
  it('turns ?code= into the header, and never passes the code on in a URL', async () => {
    const { req, res } = createMocks({ method: 'POST', query: { code: CODE }, headers: { host: 'api.example.test' }, body: {} });

    await handler(req as any, res as any);

    const [url, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe(`Bearer ${CODE}`);
    expect(url).toBe('http://ap2service:8984/mcp/');
    expect(url).not.toContain(CODE);
  });

  it('prefers a header to ?code=', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      query: { code: CODE },
      headers: { authorization: 'Bearer sd_access_fromheader' },
      body: {}
    });

    await handler(req as any, res as any);

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer sd_access_fromheader');
  });

  it('ignores a ?code= that is not an access code', async () => {
    for (const code of ['sd_live_' + 'A'.repeat(43), 'Bearer x', 'sd_access_short', ['a', 'b']]) {
      fetchMock.mockClear();
      const { req, res } = createMocks({ method: 'POST', query: { code } as any, body: {} });
      await handler(req as any, res as any);
      expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
    }
  });
});
