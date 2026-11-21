/**
 * @jest-environment node
 *
 * PATCH /api/contracts/{id}/dispute: contractservice refuses with an empty body (403 not a
 * party, 404 no such contract). Those refusals must come back as themselves, not as a 500.
 */
import { createMocks as createTypedMocks } from 'node-mocks-http';
import handler from '@/pages/api/contracts/[id]/dispute';

const createMocks = (options: Record<string, unknown>): { req: any; res: any } => createTypedMocks(options as any) as any;
const fetchMock = jest.fn();

describe('/api/contracts/[id]/dispute', () => {
  const env = process.env.CONTRACT_SERVICE_URL;
  beforeEach(() => {
    process.env.CONTRACT_SERVICE_URL = 'http://contractservice:8080';
    global.fetch = fetchMock as any;
    fetchMock.mockReset();
  });
  afterAll(() => {
    process.env.CONTRACT_SERVICE_URL = env;
  });

  const call = () => createMocks({
    method: 'PATCH',
    query: { id: 'c1' },
    headers: { authorization: 'Bearer tok' },
    body: { reason: 'not delivered', refundPercent: 100 },
  });

  it('passes a saved entry back', async () => {
    fetchMock.mockResolvedValue(new Response('{"id":"c1","disputes":[]}', { status: 200 }));
    const { req, res } = call();
    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    expect(res._getJSONData()).toEqual({ id: 'c1', disputes: [] });
  });

  it.each([
    [403, 'Only the buyer, seller or Third Voter can add a dispute entry'],
    [404, 'Contract not found'],
    [409, 'This payment has not been funded, so there is nothing to dispute yet'],
    [503, 'Could not confirm this payment’s funding right now. Try again shortly.'],
  ])('keeps an empty-bodied %i refusal rather than turning it into a 500', async (status, error) => {
    fetchMock.mockResolvedValue(new Response(null, { status }));
    const { req, res } = call();
    await handler(req, res);
    expect(res._getStatusCode()).toBe(status);
    expect(res._getJSONData()).toEqual({ error });
  });

  it('passes on contractservice’s own error message when it gives one', async () => {
    fetchMock.mockResolvedValue(new Response('{"error":"Invalid Request"}', { status: 400 }));
    const { req, res } = call();
    await handler(req, res);
    expect(res._getStatusCode()).toBe(400);
    expect(res._getJSONData()).toEqual({ error: 'Invalid Request' });
  });
});
