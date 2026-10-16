/**
 * Telling a service which client a call came from — only when the route asks, because userservice
 * refuses a service lookup that carries forwarding headers.
 */
import { createMocks } from 'node-mocks-http';
import { clientIp, proxyToService } from '@/lib/server/serviceProxy';

const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => '{}' });
  global.fetch = fetchMock as any;
  process.env.AP2_SERVICE_URL = 'http://ap2service:8984';
});

describe('clientIp', () => {
  it('takes the last X-Forwarded-For entry, the one Caddy wrote', () => {
    const { req } = createMocks({ headers: { 'x-forwarded-for': '10.0.0.1, 203.0.113.7' } });
    expect(clientIp(req as any)).toBe('203.0.113.7');
  });
});

describe('proxyToService', () => {
  it('forwards the client address when asked', async () => {
    const { req, res } = createMocks({ method: 'POST', headers: { 'x-forwarded-for': '203.0.113.7' } });
    await proxyToService(req as any, res as any, {
      service: 'ap2', path: '/request', method: 'POST', requiresAuth: false, forwardClientIp: true
    });
    expect(fetchMock.mock.calls[0][1].headers['X-Forwarded-For']).toBe('203.0.113.7');
  });

  it('does not forward it otherwise', async () => {
    const { req, res } = createMocks({ method: 'GET', headers: { 'x-forwarded-for': '203.0.113.7' } });
    await proxyToService(req as any, res as any, { service: 'ap2', path: '/health', requiresAuth: false });
    expect(fetchMock.mock.calls[0][1].headers['X-Forwarded-For']).toBeUndefined();
  });

  it('passes a merchant API key on as the bearer', async () => {
    const { req, res } = createMocks({ method: 'POST', headers: { authorization: 'Bearer sd_live_abc' } });
    await proxyToService(req as any, res as any, {
      service: 'ap2', path: '/request', method: 'POST', requiresAuth: false
    });
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer sd_live_abc');
  });
});
