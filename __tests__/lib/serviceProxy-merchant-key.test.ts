/**
 * A merchant API key reaches ap2service as the bearer, unchanged: ap2service, not this proxy,
 * decides what it is.
 */
import { createMocks } from 'node-mocks-http';
import { proxyToService } from '@/lib/server/serviceProxy';

const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => '{}' });
  global.fetch = fetchMock as any;
  process.env.AP2_SERVICE_URL = 'http://ap2service:8984';
});

describe('proxyToService', () => {
  it('passes a merchant API key on as the bearer', async () => {
    const { req, res } = createMocks({ method: 'POST', headers: { authorization: 'Bearer sd_live_abc' } });
    await proxyToService(req as any, res as any, {
      service: 'ap2', path: '/request', method: 'POST', requiresAuth: false
    });
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer sd_live_abc');
  });
});
