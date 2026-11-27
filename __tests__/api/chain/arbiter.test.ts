import handler from '@/pages/api/chain/contract/[contractAddress]/arbiter';

jest.mock('@/utils/api-auth', () => ({ requireAuth: () => 'user-token' }));

/** The arbiter read goes out as the user, never with the service key. */
describe('/api/chain/contract/[contractAddress]/arbiter', () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as any;
    process.env.CHAIN_SERVICE_URL = 'http://chainservice:8978';
    process.env.X_API_KEY = 'a-service-key';
  });
  afterEach(() => { delete process.env.X_API_KEY; });

  it('forwards the user session and no X-API-Key', async () => {
    fetchMock.mockResolvedValue({ status: 200, json: async () => ({ cohort: 'MARKETPLACE_CAPABLE' }) });
    const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await handler({ method: 'GET', query: { contractAddress: '0xabc' }, headers: { cookie: 'AUTH-TOKEN=x' } } as any, res);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://chainservice:8978/api/chain/contract/0xabc/arbiter');
    expect(init.headers.Authorization).toBe('Bearer user-token');
    expect(init.headers['X-API-Key']).toBeUndefined();
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
