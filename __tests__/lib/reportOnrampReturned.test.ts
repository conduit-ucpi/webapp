/**
 * Recording that Coinbase sent a buyer back must carry nothing about them, and must never get in
 * the way of sending them on.
 */
import { reportOnrampReturned } from '@/lib/reportOnrampReturned';

/** The "without cookies" holds for the return line; the status look-up is the signed-in buyer's. */
describe('reportOnrampReturned', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  it('names the contract from the path they are returning to, without cookies', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 204 });
    global.fetch = fetchMock as any;

    await reportOnrampReturned('/contract-pay?contractId=6aed2961fb90e006e8538f7d');

    const [url, init] = fetchMock.mock.calls.find(([called]) => /onramp-returned/.test(called))!;
    expect(url).toMatch(/\/api\/coinbase\/onramp-returned\?contract=6aed2961fb90e006e8538f7d$/);
    expect(init).toEqual({ method: 'POST', credentials: 'omit', keepalive: true });
  });

  it("also has the server ask Coinbase how the buyer's purchase stands, with the session", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 204 });
    global.fetch = fetchMock as any;

    await reportOnrampReturned('/contract-pay?contractId=6aed2961fb90e006e8538f7d');

    const [url, init] = fetchMock.mock.calls.find(([called]) => /onramp-status/.test(called))!;
    expect(url).toMatch(/\/api\/coinbase\/onramp-status\?trigger=returned&contract=6aed2961fb90e006e8538f7d$/);
    expect(init).toEqual({ method: 'POST', credentials: 'include', keepalive: true });
  });

  it('still reports a return that is not to a payment request', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 204 });
    global.fetch = fetchMock as any;

    await reportOnrampReturned(undefined);

    expect(fetchMock.mock.calls.map(([url]) => url)).toContainEqual(expect.stringMatching(/\/api\/coinbase\/onramp-returned$/));
  });

  it('never throws when the call fails', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network')) as any;
    await expect(reportOnrampReturned('/pay')).resolves.toBeUndefined();
  });
});
