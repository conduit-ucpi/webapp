/**
 * The country is advice, so every failure must come back as "unknown" and never throw.
 */
import { _resetVisitorCountryForTesting, visitorCountry } from '@/lib/visitorCountry';

const trace = (text: string, ok = true) => jest.fn().mockResolvedValue({ ok, text: async () => text });

describe('visitorCountry', () => {
  const realFetch = global.fetch;
  beforeEach(() => _resetVisitorCountryForTesting());
  afterEach(() => {
    global.fetch = realFetch;
    window.history.replaceState({}, '', '/');
  });

  it("reads Cloudflare's answer, from the page's own domain", async () => {
    global.fetch = trace('fl=1\nloc=VE\ntls=TLSv1.3\n') as any;
    await expect(visitorCountry()).resolves.toBe('VE');
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe('/cdn-cgi/trace');
  });

  it('asks once per page', async () => {
    global.fetch = trace('loc=GB') as any;
    await visitorCountry();
    await visitorCountry();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['no country data', trace('loc=XX')],
    ['a Tor exit', trace('loc=T1')],
    ['a page with no trace, as on localhost', trace('<html>not found</html>', false)],
    ['a failed call', jest.fn().mockRejectedValue(new Error('network'))],
  ])('answers null for %s', async (_name, fetchMock) => {
    global.fetch = fetchMock as any;
    await expect(visitorCountry()).resolves.toBeNull();
  });

  it('takes a test country on localhost, without asking', async () => {
    global.fetch = trace('loc=GB') as any;
    window.history.replaceState({}, '', '/?testCountry=ve');
    await expect(visitorCountry()).resolves.toBe('VE');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
