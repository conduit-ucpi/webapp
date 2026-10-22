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

  it('passes an access code on as the bearer too', async () => {
    const { req, res } = createMocks({ method: 'POST', headers: { authorization: 'Bearer sd_access_abc' } });
    await proxyToService(req as any, res as any, {
      service: 'ap2', path: '/settle', method: 'POST', requiresAuth: false
    });
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer sd_access_abc');
  });

  /** ap2service builds the links in its answers (the docs section on access codes) on this host. */
  it('tells ap2service which public host the caller used', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      headers: { host: 'api.example.test', 'x-forwarded-proto': 'https' }
    });
    await proxyToService(req as any, res as any, { service: 'ap2', path: '/settle', method: 'POST', requiresAuth: false });
    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers['X-Forwarded-Host']).toBe('api.example.test');
    expect(headers['X-Forwarded-Proto']).toBe('https');
  });

  /** userservice refuses service lookups that carry a forwarded header, so it never gets one. */
  it('never sends forwarded headers to any other service', async () => {
    process.env.USER_SERVICE_URL = 'http://userservice:8977';
    const { req, res } = createMocks({
      method: 'GET',
      headers: { host: 'api.example.test', authorization: 'Bearer t' }
    });
    await proxyToService(req as any, res as any, { service: 'user', path: '/api/user/api-access-key' });
    expect(fetchMock.mock.calls[0][1].headers['X-Forwarded-Host']).toBeUndefined();
  });

  it('answers with the status a route chooses when it overrides one', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 409, text: async () => '{"reason":"TERMS_NOT_ACCEPTED"}' });
    process.env.USER_SERVICE_URL = 'http://userservice:8977';
    const { req, res } = createMocks({ method: 'POST', headers: { authorization: 'Bearer t' } });
    await proxyToService(req as any, res as any, {
      service: 'user', path: '/x', method: 'POST', statusFor: (status) => (status === 409 ? 401 : status)
    });
    expect(res._getStatusCode()).toBe(401);
    expect(JSON.parse(res._getData())).toEqual({ reason: 'TERMS_NOT_ACCEPTED' });
  });
});
