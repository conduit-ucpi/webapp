/**
 * The userservice's status must reach the browser, including a refusal with no body, and the
 * address must not reach the log.
 */
import { createMocks } from 'node-mocks-http';
import handler from '@/pages/api/auth/update-email';

const answer = (status: number, body = '') =>
  jest.fn().mockResolvedValue({
    status,
    statusText: '',
    text: async () => body,
    headers: { getSetCookie: () => [] },
  });

const put = async () => {
  const { req, res } = createMocks({ method: 'PUT', body: { email: 'someone@example.com' } });
  await handler(req as any, res as any);
  return res;
};

describe('PUT /api/auth/update-email', () => {
  const realFetch = global.fetch;
  let log: jest.SpyInstance;
  let error: jest.SpyInstance;
  beforeEach(() => {
    log = jest.spyOn(console, 'log').mockImplementation(() => {});
    error = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    global.fetch = realFetch;
    log.mockRestore();
    error.mockRestore();
  });

  it('passes on a refusal with an empty body, rather than turning it into a 500', async () => {
    global.fetch = answer(409) as any;
    const res = await put();
    expect(res._getStatusCode()).toBe(409);
    expect(error).not.toHaveBeenCalled();
  });

  it('passes on the updated user', async () => {
    global.fetch = answer(200, JSON.stringify({ email: 'someone@example.com' })) as any;
    const res = await put();
    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData()).email).toBe('someone@example.com');
  });

  it('never logs the address', async () => {
    global.fetch = answer(409) as any;
    await put();
    expect(JSON.stringify(log.mock.calls)).not.toContain('someone@example.com');
  });

  it('answers 500 when the service cannot be reached', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('down')) as any;
    expect((await put())._getStatusCode()).toBe(500);
  });
});
