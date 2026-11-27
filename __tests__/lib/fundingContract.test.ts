/**
 * Which payment the funding lines are about: what the pay page says it is showing, since /pay's
 * own address carries no contract id, and otherwise the `contractId` in an address.
 */
import { fundingContract, setFundingContract } from '@/lib/fundingContract';
import { reportFundingEvent } from '@/lib/reportFundingEvent';

jest.mock('@/lib/visitorCountry', () => ({ visitorCountry: () => Promise.resolve(null) }));

afterEach(() => {
  setFundingContract(null);
  window.history.replaceState({}, '', '/');
});

it("is the payment the page says it is showing, whatever the page's address", () => {
  window.history.replaceState({}, '', '/pay?resume=abc');
  expect(fundingContract()).toBeUndefined();
  setFundingContract('6b081501c3c6f2734bc0861c');
  expect(fundingContract()).toBe('6b081501c3c6f2734bc0861c');
  setFundingContract(null);
  expect(fundingContract()).toBeUndefined();
});

it("falls back to the contractId in the page's address, or in one it is given", () => {
  window.history.replaceState({}, '', '/contract-pay?contractId=req-1');
  expect(fundingContract()).toBe('req-1');
  expect(fundingContract('/contract-pay?contractId=req-2')).toBe('req-2');
});

it('goes out on every funding line', async () => {
  const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 204 });
  global.fetch = fetchMock as any;
  window.history.replaceState({}, '', '/pay?resume=abc');
  setFundingContract('6b081501c3c6f2734bc0861c');
  await reportFundingEvent('address-polled', { wallet: '0xabc' });
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ event: 'address-polled', contract: '6b081501c3c6f2734bc0861c' });
});
