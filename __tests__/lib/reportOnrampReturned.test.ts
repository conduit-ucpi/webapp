/**
 * Recording that Coinbase sent a buyer back must carry nothing about them, and must never get in
 * the way of sending them on.
 */
import { reportOnrampReturned } from '@/lib/reportOnrampReturned';

describe('reportOnrampReturned', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  it('names the contract from the path they are returning to, without cookies', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 204 });
    global.fetch = fetchMock as any;

    await reportOnrampReturned('/contract-pay?contractId=6aed2961fb90e006e8538f7d');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/api\/coinbase\/onramp-returned\?contract=6aed2961fb90e006e8538f7d$/);
    expect(init).toEqual({ method: 'POST', credentials: 'omit', keepalive: true });
  });

  it('still reports a return that is not to a payment request', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 204 });
    global.fetch = fetchMock as any;

    await reportOnrampReturned(undefined);

    expect(fetchMock.mock.calls[0][0]).toMatch(/\/api\/coinbase\/onramp-returned$/);
  });

  it('never throws when the call fails', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network')) as any;
    await expect(reportOnrampReturned('/pay')).resolves.toBeUndefined();
  });
});
