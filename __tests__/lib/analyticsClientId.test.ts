/**
 * The GA client id handed to the payment pages: only with analytics consent, only from our own GA,
 * and never something that can hold up or break a payment.
 */

// Inlined by Next at build time; must be set before lib/consent loads (see CookieConsent.test.tsx).
process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = 'G-TEST000000';
const consent = require('@/lib/consent');
const sdk = require('@/lib/analyticsClientId');

function clearCookies() {
  for (const c of document.cookie.split('; ')) {
    const name = c.split('=')[0];
    if (name) document.cookie = `${name}=; Max-Age=0; Path=/`;
  }
}

/** GA as it behaves once gtag.js has loaded: answers `get` through the callback. */
function gaAnswers(id: string | undefined) {
  window.gtag = (...args: unknown[]) => {
    if (args[0] === 'get' && args[2] === 'client_id') (args[3] as (v: unknown) => void)(id);
  };
}

describe('lib/consent analyticsClientId', () => {
  beforeEach(() => {
    clearCookies();
    document.head.innerHTML = '';
  });

  it('is null before any choice, and GA is never asked', async () => {
    const gtag = jest.fn();
    window.gtag = gtag;
    expect(await consent.analyticsClientId()).toBeNull();
    expect(gtag).not.toHaveBeenCalled();
  });

  it("answers GA's client id once the visitor has consented", async () => {
    consent.writeConsent('granted');
    consent.loadAnalytics();
    gaAnswers('1234567890.1729600000');
    expect(await consent.analyticsClientId()).toBe('1234567890.1729600000');
  });

  it('is null once consent is withdrawn, though gtag stays defined', async () => {
    consent.writeConsent('granted');
    consent.loadAnalytics();
    gaAnswers('1234567890.1729600000');
    consent.writeConsent('denied');
    consent.disableAnalytics();
    expect(window.gtag).toBeDefined();
    expect(await consent.analyticsClientId()).toBeNull();
  });

  it('gives up when GA never answers (blocked by an extension, say)', async () => {
    consent.writeConsent('granted');
    consent.loadAnalytics();
    window.gtag = () => {};
    expect(await consent.analyticsClientId(10)).toBeNull();
  });
});

describe('SDK analyticsClientId', () => {
  afterEach(() => sdk.setAnalyticsClientIdSource(null));

  it('is null where the host app registered nothing (a partner site)', async () => {
    gaAnswers('9.9');
    expect(await sdk.analyticsClientId()).toBeNull();
  });

  it("answers the registered source, and a failing source is just null", async () => {
    sdk.setAnalyticsClientIdSource(async () => '1.2');
    expect(await sdk.analyticsClientId()).toBe('1.2');
    sdk.setAnalyticsClientIdSource(async () => {
      throw new Error('nope');
    });
    expect(await sdk.analyticsClientId()).toBeNull();
  });
});

describe('SDK attachAnalyticsClientId', () => {
  afterEach(() => sdk.setAnalyticsClientIdSource(null));

  it('posts the id to the contract with the given fetcher', async () => {
    sdk.setAnalyticsClientIdSource(async () => '1234567890.1729600000');
    const fetcher = jest.fn().mockResolvedValue({ ok: true });
    await sdk.attachAnalyticsClientId('req 1', fetcher);
    expect(fetcher).toHaveBeenCalledWith('/api/contracts/req%201/analytics-client', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ clientId: '1234567890.1729600000' }),
    }));
  });

  it('sends nothing without an id (no consent, or a partner site)', async () => {
    const fetcher = jest.fn();
    await sdk.attachAnalyticsClientId('c1', fetcher);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('never throws, so it cannot fail a payment', async () => {
    sdk.setAnalyticsClientIdSource(async () => '1.2');
    await expect(sdk.attachAnalyticsClientId('c1', jest.fn().mockRejectedValue(new Error('offline')))).resolves.toBeUndefined();
  });
});
