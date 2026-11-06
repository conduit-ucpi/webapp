/**
 * Whether Coinbase can take money in a country. Being listed is not enough: a crypto balance is not
 * a way to buy.
 */
import { createMocks } from 'node-mocks-http';
import handler, { _resetOnrampSupportCacheForTesting } from '@/pages/api/coinbase/onramp-support';
import { cdpRequest, getCdpCredentials } from '@/lib/server/coinbaseCdp';

jest.mock('@/lib/server/coinbaseCdp', () => ({ cdpRequest: jest.fn(), getCdpCredentials: jest.fn() }));

const config = {
  countries: [
    { id: 'GB', payment_methods: [{ id: 'CARD' }, { id: 'CRYPTO_ACCOUNT' }] },
    { id: 'MX', payment_methods: [{ id: 'CRYPTO_ACCOUNT' }] },
  ],
};
const answer = (body: unknown = config, ok = true) =>
  (cdpRequest as jest.Mock).mockResolvedValue({ ok, status: ok ? 200 : 500, text: async () => JSON.stringify(body) });

const ask = async (country: string) => {
  const { req, res } = createMocks({ method: 'GET', query: { country } });
  await handler(req as any, res as any);
  return res;
};
const supported = async (country: string) => JSON.parse((await ask(country))._getData()).supported;

describe('GET /api/coinbase/onramp-support', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _resetOnrampSupportCacheForTesting();
    (getCdpCredentials as jest.Mock).mockReturnValue({ id: 'k', secret: 's' });
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('says yes where a buyer can pay with money', async () => {
    answer();
    await expect(supported('GB')).resolves.toBe(true);
  });

  it('says no where only an existing Coinbase balance works', async () => {
    answer();
    await expect(supported('MX')).resolves.toBe(false);
  });

  it('says no where the country is not listed', async () => {
    answer();
    await expect(supported('VE')).resolves.toBe(false);
  });

  it('asks Coinbase once an hour, not for every buyer', async () => {
    answer();
    await ask('GB');
    await ask('MX');
    expect(cdpRequest).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['a failed call', () => answer(config, false)],
    ['an empty list, which must not read as "serves nobody"', () => answer({ countries: [] })],
  ])('reports %s rather than answering', async (_name, arrange) => {
    arrange();
    expect((await ask('GB'))._getStatusCode()).toBe(502);
  });

  it('refuses anything but a country code', async () => {
    expect((await ask('venezuela'))._getStatusCode()).toBe(400);
    expect(cdpRequest).not.toHaveBeenCalled();
  });
});
