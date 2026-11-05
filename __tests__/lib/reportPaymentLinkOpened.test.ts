/**
 * Recording that a payment link was opened must carry nothing about the visitor, and must never
 * get in the way of the payment.
 */
import { reportPaymentLinkOpened } from '@/lib/reportPaymentLinkOpened';

describe('reportPaymentLinkOpened', () => {
  const realFetch = global.fetch;
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

  it('never throws when the call fails', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network')) as any;
    await expect(reportPaymentLinkOpened('x')).resolves.toBeUndefined();
  });

  it('never throws on a refusal, such as a partner site without the route', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 }) as any;
    await expect(reportPaymentLinkOpened('x')).resolves.toBeUndefined();
  });
});
