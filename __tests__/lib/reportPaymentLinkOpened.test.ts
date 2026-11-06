/**
 * Recording that a payment link was opened must carry nothing about the visitor, and must never
 * get in the way of the payment.
 */
import { reportPaymentLinkOpened } from '@/lib/reportPaymentLinkOpened';

describe('reportPaymentLinkOpened', () => {
  const realFetch = global.fetch;
  beforeEach(() => sessionStorage.clear());
  afterEach(() => {
    global.fetch = realFetch;
  });

  it('posts to the contract\'s route without cookies or a body', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 204 });
    global.fetch = fetchMock as any;

    await reportPaymentLinkOpened('6aec3ebd01a76609027a054b');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/api\/contracts\/6aec3ebd01a76609027a054b\/link-opened$/);
    expect(init).toEqual({ method: 'POST', credentials: 'omit', keepalive: true });
  });

  it('counts one visit per tab, so a reload or a return from Coinbase is not another opening', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 204 });
    global.fetch = fetchMock as any;

    await reportPaymentLinkOpened('link-a');
    await reportPaymentLinkOpened('link-a');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await reportPaymentLinkOpened('link-b');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('still reports when the tab has no storage to remember it in', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 204 });
    global.fetch = fetchMock as any;
    const blocked = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    await expect(reportPaymentLinkOpened('link-c')).resolves.toBeUndefined();
    blocked.mockRestore();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('never throws when the call fails', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network')) as any;
    await expect(reportPaymentLinkOpened('x')).resolves.toBeUndefined();
  });

  it('never throws on a refusal, such as a partner site without the route', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 }) as any;
    await expect(reportPaymentLinkOpened('x')).resolves.toBeUndefined();
  });
});
