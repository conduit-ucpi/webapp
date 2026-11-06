/**
 * Coinbase's smallest card purchase, read from Coinbase rather than copied here.
 */
import { createMocks } from 'node-mocks-http';
import handler from '@/pages/api/coinbase/onramp-minimum';
import { cdpRequest, getCdpCredentials } from '@/lib/server/coinbaseCdp';

jest.mock('@/lib/server/coinbaseCdp', () => ({ cdpRequest: jest.fn(), getCdpCredentials: jest.fn() }));

const options = {
  payment_currencies: [
    { id: 'USD', limits: [{ id: 'ACH_BANK_ACCOUNT', min: '10' }, { id: 'CARD', min: '2' }] },
    { id: 'MXN', limits: [{ id: 'CARD', min: '38' }] },
    { id: 'XXX', limits: [{ id: 'FIAT_WALLET', min: '2' }] },
  ],
};
const answer = (ok = true) =>
  (cdpRequest as jest.Mock).mockResolvedValue({ ok, status: ok ? 200 : 500, text: async () => JSON.stringify(options) });

const ask = async (currency: string) => {
  const { req, res } = createMocks({ method: 'GET', query: { currency } });
  await handler(req as any, res as any);
  return res;
};

describe('GET /api/coinbase/onramp-minimum', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getCdpCredentials as jest.Mock).mockReturnValue({ id: 'k', secret: 's' });
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  it("answers the card limit, not another method's", async () => {
    answer();
    const res = await ask('USD');
    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toEqual({ currency: 'USD', minimum: 2 });
  });

  it('asks Coinbase once an hour, not for every buyer', async () => {
    answer();
    await ask('MXN');
    await ask('MXN');
    expect(cdpRequest).toHaveBeenCalledTimes(1);
  });

  it('says so when Coinbase has no card limit for the currency', async () => {
    answer();
    expect((await ask('XXX'))._getStatusCode()).toBe(404);
  });

  it('reports a failed lookup rather than inventing a figure', async () => {
    answer(false);
    expect((await ask('EUR'))._getStatusCode()).toBe(502);
  });

  it('refuses anything but a currency code', async () => {
    expect((await ask('usd; drop'))._getStatusCode()).toBe(400);
    expect(cdpRequest).not.toHaveBeenCalled();
  });
});
