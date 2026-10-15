import { createMocks } from 'node-mocks-http';
import handler from '@/pages/api/sd-reporting/contracts';

global.fetch = jest.fn();
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

const reply = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response);

const query = { createdTimestampFrom: 1, createdTimestampTo: 2 };

function post(cookie = 'AUTH-TOKEN=tok') {
  return createMocks({ method: 'POST', headers: { cookie }, body: query });
}

/**
 * The /sd-reporting list reaches the browser only through this route. It must check the caller's
 * type with userservice, as the admin routes do, before asking contractservice for anything.
 */
describe('/api/sd-reporting/contracts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.USER_SERVICE_URL = 'http://userservice:8977';
    process.env.CONTRACT_SERVICE_URL = 'http://contractservice:8979';
  });

  it.each(['sd-reporting', 'admin'])('checks the caller is %s, then asks the redacted reporting query with their credentials', async (userType) => {
    mockFetch
      .mockResolvedValueOnce(reply(200, { userType }))
      .mockResolvedValueOnce(reply(200, [{ id: 'c1' }]));
    const { req, res } = post();
    await handler(req as any, res as any);

    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toEqual([{ id: 'c1' }]);
    expect(mockFetch.mock.calls[0][0]).toBe('http://userservice:8977/api/user/identity');
    const [url, init] = mockFetch.mock.calls[1];
    // The redacted endpoint, never the admin one, whoever is asking.
    expect(url).toBe('http://contractservice:8979/api/contracts/reporting/database');
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer tok', Cookie: 'AUTH-TOKEN=tok' });
    expect(JSON.parse((init as RequestInit).body as string)).toEqual(query);
  });

  it.each(['normal', 'Admin', 'sd-reporting ', undefined])('refuses userType %s without asking contractservice', async (userType) => {
    mockFetch.mockResolvedValueOnce(reply(200, { userType }));
    const { req, res } = post();
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(403);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('needs a session before anything is asked', async () => {
    const { req, res } = post('');
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(401);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('refuses a session userservice rejects', async () => {
    mockFetch.mockResolvedValueOnce(reply(401, {}));
    const { req, res } = post();
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(401);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('passes contractservice refusals through', async () => {
    mockFetch
      .mockResolvedValueOnce(reply(200, { userType: 'sd-reporting' }))
      .mockResolvedValueOnce(reply(403, {}));
    const { req, res } = post();
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(403);
  });

  it('only answers POST', async () => {
    const { req, res } = createMocks({ method: 'GET' });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(405);
  });
});
