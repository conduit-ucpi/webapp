import { createMocks } from 'node-mocks-http';
import handler from '@/pages/api/admin/sweep-fees';

global.fetch = jest.fn();
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

const upstream = (status: number, body: unknown) =>
  ({ status, text: async () => JSON.stringify(body) } as unknown as Response);

const escrow = '0xE0b241AbfCfb942A77d01dc24478526AE3aC95c8';
const a1 = '0x1111111111111111111111111111111111111111';
const a2 = '0x2222222222222222222222222222222222222222';

/**
 * The browser's only way to sweepFees. It carries the admin's session to chainservice, which
 * decides who may sweep; this route only reshapes the form into legs.
 */
describe('/api/admin/sweep-fees', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CHAIN_SERVICE_URL = 'http://chainservice:8978';
  });

  it('is POST only', async () => {
    const { req, res } = createMocks({ method: 'GET', headers: { cookie: 'AUTH-TOKEN=tok' } });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(405);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('needs a session before anything is forwarded', async () => {
    const { req, res } = createMocks({ method: 'POST', body: { contractAddress: escrow, target1: a1, bps1: '10000' } });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(401);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('sends one leg when address 2 is blank, with the admin token', async () => {
    mockFetch.mockResolvedValueOnce(upstream(200, { success: true, transactionHash: '0xhash' }));
    const { req, res } = createMocks({
      method: 'POST', headers: { cookie: 'AUTH-TOKEN=tok' },
      body: { contractAddress: escrow, target1: a1, bps1: '10000', target2: '', bps2: '0' }
    });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(200);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('http://chainservice:8978/api/admin/sweep-fees');
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer tok' });
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      contractAddress: escrow, legs: [{ target: a1, bps: 10000 }]
    });
  });

  it('sends two legs for a split', async () => {
    mockFetch.mockResolvedValueOnce(upstream(200, { success: true }));
    const { req, res } = createMocks({
      method: 'POST', headers: { cookie: 'AUTH-TOKEN=tok' },
      body: { contractAddress: escrow, target1: a1, bps1: '7000', target2: a2, bps2: '3000' }
    });
    await handler(req as any, res as any);
    expect(JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string).legs).toEqual([
      { target: a1, bps: 7000 }, { target: a2, bps: 3000 }
    ]);
  });

  it("passes chainservice's refusal through", async () => {
    mockFetch.mockResolvedValueOnce(upstream(409, { success: false, error: 'No fee to sweep' }));
    const { req, res } = createMocks({
      method: 'POST', headers: { cookie: 'AUTH-TOKEN=tok' },
      body: { contractAddress: escrow, target1: a1, bps1: '10000' }
    });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(409);
    expect(JSON.parse(res._getData()).error).toBe('No fee to sweep');
  });
});
