/**
 * Reporting a funding step must carry no session, and must never get in the way of the payment.
 */
import { reportFundingEvent } from '@/lib/reportFundingEvent';

jest.mock('@/lib/visitorCountry', () => ({ visitorCountry: async () => 'VE' }));

describe('reportFundingEvent', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  it('posts the step without cookies', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 204 });
    global.fetch = fetchMock as any;

    await reportFundingEvent('privy-failed', { wallet: '0xabc', detail: 'No quotes' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/api\/funding-event$/);
    expect(init.credentials).toBe('omit');
    expect(JSON.parse(init.body)).toMatchObject({ event: 'privy-failed', wallet: '0xabc', detail: 'No quotes', locale: navigator.language, country: 'VE' });
  });

  it('never throws when the call fails', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network')) as any;
    await expect(reportFundingEvent('transfer-opened')).resolves.toBeUndefined();
  });
});
