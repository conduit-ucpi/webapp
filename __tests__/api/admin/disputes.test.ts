import { createMocks } from 'node-mocks-http';
import queueHandler from '@/pages/api/admin/disputes/index';
import releaseHandler from '@/pages/api/admin/disputes/release';
import decideHandler from '@/pages/api/admin/disputes/[id]/decide';

global.fetch = jest.fn();
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

const upstream = (status: number, body: unknown) =>
  ({ status, text: async () => JSON.stringify(body) } as unknown as Response);

/**
 * The arbiter's admin surface reaches the browser only through these routes. Each one must carry
 * the session, pass disputeservice's own verdict through (it decides who is an admin), and never
 * be reachable without a session.
 */
describe('/api/admin/disputes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.DISPUTE_SERVICE_URL = 'http://disputeservice:8981';
  });

  it('forwards the queue read with the session and returns the service answer', async () => {
    mockFetch.mockResolvedValueOnce(upstream(200, [{ contractId: 'c1', status: 'HOLD' }]));
    const { req, res } = createMocks({ method: 'GET', headers: { cookie: 'AUTH-TOKEN=tok' } });
    await queueHandler(req as any, res as any);
    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toEqual([{ contractId: 'c1', status: 'HOLD' }]);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('http://disputeservice:8981/api/disputes');
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer tok' });
  });

  it('needs a session before anything is forwarded', async () => {
    const { req, res } = createMocks({ method: 'GET' });
    await queueHandler(req as any, res as any);
    expect(res._getStatusCode()).toBe(401);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("passes disputeservice's 403 through for a non-admin", async () => {
    mockFetch.mockResolvedValueOnce(upstream(403, { error: 'Forbidden' }));
    const { req, res } = createMocks({ method: 'GET', headers: { cookie: 'AUTH-TOKEN=tok' } });
    await queueHandler(req as any, res as any);
    expect(res._getStatusCode()).toBe(403);
  });

  it('release is POST only and forwards the body', async () => {
    const { req: get, res: getRes } = createMocks({ method: 'GET', headers: { cookie: 'AUTH-TOKEN=tok' } });
    await releaseHandler(get as any, getRes as any);
    expect(getRes._getStatusCode()).toBe(405);

    mockFetch.mockResolvedValueOnce(upstream(200, { proposed: ['c1'], safeAppUrl: 'https://app.safe.global/x' }));
    const { req, res } = createMocks({ method: 'POST', headers: { cookie: 'AUTH-TOKEN=tok' }, body: { contractIds: ['c1'] } });
    await releaseHandler(req as any, res as any);
    expect(res._getStatusCode()).toBe(200);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('http://disputeservice:8981/api/disputes/release');
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ contractIds: ['c1'] });
  });

  it('decide forwards the reviewer decision to the named case', async () => {
    mockFetch.mockResolvedValueOnce(upstream(200, { status: 'HOLD', buyerPercentage: 30 }));
    const { req, res } = createMocks({
      method: 'POST', headers: { cookie: 'AUTH-TOKEN=tok' }, query: { id: 'c1' },
      body: { buyerPercentage: 30, reasoning: 'tracking shows the wrong city' },
    });
    await decideHandler(req as any, res as any);
    expect(res._getStatusCode()).toBe(200);
    expect(mockFetch.mock.calls[0][0]).toBe('http://disputeservice:8981/api/disputes/c1/decide');
  });

  it('is a configuration error, not a crash, when the service URL is unset', async () => {
    delete process.env.DISPUTE_SERVICE_URL;
    const { req, res } = createMocks({ method: 'GET', headers: { cookie: 'AUTH-TOKEN=tok' } });
    await queueHandler(req as any, res as any);
    expect(res._getStatusCode()).toBe(500);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
