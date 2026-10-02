import { createMocks } from 'node-mocks-http';
import rulesHandler from '@/pages/api/arbitration/rules';

global.fetch = jest.fn();
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

const upstream = (status: number, body: unknown) =>
  ({ status, text: async () => JSON.stringify(body) } as unknown as Response);

/** The public policy page reads the rules through this route, before anyone has signed in. */
describe('/api/arbitration/rules', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.DISPUTE_SERVICE_URL = 'http://disputeservice:8981';
  });

  it('serves the rules without a session, with the version disputeservice reports', async () => {
    const rules = { policySha: 'a'.repeat(40), policyCommittedAt: 1790361496, policyModified: false, buildSha: 'b'.repeat(40), sections: [] };
    mockFetch.mockResolvedValueOnce(upstream(200, rules));
    const { req, res } = createMocks({ method: 'GET' });
    await rulesHandler(req as any, res as any);
    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toEqual(rules);
    expect(mockFetch.mock.calls[0][0]).toBe('http://disputeservice:8981/policy/rules');
    expect(res.getHeader('Cache-Control')).toBe('public, max-age=300');
  });

  it('is GET only', async () => {
    const { req, res } = createMocks({ method: 'POST' });
    await rulesHandler(req as any, res as any);
    expect(res._getStatusCode()).toBe(405);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("passes disputeservice's failure through rather than inventing rules", async () => {
    mockFetch.mockResolvedValueOnce(upstream(503, { error: 'unavailable' }));
    const { req, res } = createMocks({ method: 'GET' });
    await rulesHandler(req as any, res as any);
    expect(res._getStatusCode()).toBe(503);
  });
});
