/**
 * /api/user/api-access-key: the free access code's route. It names the terms version itself, and
 * turns "your wallet has not signed these terms" into a 401 so the page signs the user in again.
 */
import { createMocks } from 'node-mocks-http';
import handler from '@/pages/api/user/api-access-key';
import * as serviceProxy from '@/lib/server/serviceProxy';

jest.mock('@/lib/server/serviceProxy', () => ({
  ...jest.requireActual('@/lib/server/serviceProxy'),
  proxyToService: jest.fn()
}));

const proxyToService = serviceProxy.proxyToService as jest.Mock;

beforeEach(() => {
  proxyToService.mockReset();
  process.env.TERMS_VERSION = '972353c6d417';
});

describe('/api/user/api-access-key', () => {
  it('asks for a code for the terms this deployment serves, whatever the browser sent', async () => {
    const { req, res } = createMocks({ method: 'POST', body: { termsVersion: 'aaaaaaa', userId: 'someone-else' } });

    await handler(req as any, res as any);

    const options = proxyToService.mock.calls[0][2];
    expect(options).toMatchObject({ service: 'user', path: '/api/user/api-access-key', method: 'POST' });
    expect(options.body).toEqual({ termsVersion: '972353c6d417' });
    expect(res.getHeader('Cache-Control')).toBe('no-store');
  });

  it('answers "terms not signed" with 401, so the page signs the user in again', async () => {
    const { req, res } = createMocks({ method: 'POST' });
    await handler(req as any, res as any);
    const statusFor = proxyToService.mock.calls[0][2].statusFor;

    expect(statusFor(409, { reason: 'TERMS_NOT_ACCEPTED' })).toBe(401);
    expect(statusFor(409, { reason: 'SOMETHING_ELSE' })).toBe(409);
    expect(statusFor(400, { reason: 'NO_WALLET' })).toBe(400);
  });

  it.each(['GET', 'DELETE'] as const)('passes %s through', async (method) => {
    const { req, res } = createMocks({ method });
    await handler(req as any, res as any);
    expect(proxyToService.mock.calls[0][2]).toMatchObject({ service: 'user', path: '/api/user/api-access-key', method });
  });

  it('refuses anything else', async () => {
    const { req, res } = createMocks({ method: 'PUT' });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(405);
    expect(proxyToService).not.toHaveBeenCalled();
  });
});
