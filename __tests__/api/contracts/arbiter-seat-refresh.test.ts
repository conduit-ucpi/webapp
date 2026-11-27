/**
 * @jest-environment node
 *
 * POST /api/contracts/{id}/arbiter-seat/refresh: forwarded to contractservice with the caller's
 * session and no body - contractservice reads the seat from the chain, not from us.
 */
import { createMocks as createTypedMocks } from 'node-mocks-http';
import handler from '@/pages/api/contracts/[id]/arbiter-seat/refresh';

const createMocks = (options: Record<string, unknown>): { req: any; res: any } => createTypedMocks(options as any) as any;
const fetchMock = jest.fn();

describe('/api/contracts/[id]/arbiter-seat/refresh', () => {
  const env = process.env.CONTRACT_SERVICE_URL;
  beforeEach(() => {
    process.env.CONTRACT_SERVICE_URL = 'http://contractservice:8080';
    global.fetch = fetchMock as any;
    fetchMock.mockReset();
  });
  afterAll(() => {
    process.env.CONTRACT_SERVICE_URL = env;
  });

  it('forwards a POST to contractservice and passes its answer back', async () => {
    fetchMock.mockResolvedValue(new Response('{"contractId":"c1","seatedArbiter":null}', {
      status: 200, headers: { 'content-type': 'application/json' }
    }));
    const { req, res } = createMocks({ method: 'POST', query: { id: 'c1' }, headers: { authorization: 'Bearer tok' } });

    await handler(req, res);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://contractservice:8080/api/contracts/c1/arbiter-seat/refresh');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer tok');
    expect(res._getStatusCode()).toBe(200);
  });

  it('keeps contractservice’s refusal rather than flattening it to a 500', async () => {
    fetchMock.mockResolvedValue(new Response('{"error":"Could not read the arbiter seat"}', {
      status: 503, headers: { 'content-type': 'application/json' }
    }));
    const { req, res } = createMocks({ method: 'POST', query: { id: 'c1' }, headers: { authorization: 'Bearer tok' } });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(503);
  });

  it('refuses a caller who is not signed in without calling contractservice', async () => {
    const { req, res } = createMocks({ method: 'POST', query: { id: 'c1' } });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses anything but POST without calling contractservice', async () => {
    const { req, res } = createMocks({ method: 'GET', query: { id: 'c1' } });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(405);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
