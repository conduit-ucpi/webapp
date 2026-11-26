/** The note that a way of buying was opened for a payment, for a reloaded page to find. */
import { forgetPurchaseOpened, markPurchaseOpened, takePurchaseLeftOpen } from '@/lib/purchaseMarker';

const WALLET = '0x1234567890abcdef1234567890abcdef12345678';
const NOW = 1_800_000_000_000;
const KRAKEN = { logged: 'Kraken', name: 'Kraken', route: 'payment' as const };

beforeEach(() => window.localStorage.clear());

it('is found once by the page that loads next, with which company it was and what was held then, whatever the case of the address', () => {
  markPurchaseOpened(WALLET, KRAKEN, 4.5, NOW);
  expect(takePurchaseLeftOpen(WALLET.toUpperCase().replace('0X', '0x'), NOW + 60_000)).toEqual({ provider: KRAKEN, held: 4.5 });
  expect(takePurchaseLeftOpen(WALLET, NOW + 60_000)).toBeNull();
});

it('keeps no name for the card window, which has none', () => {
  markPurchaseOpened(WALLET, { logged: 'Privy', route: 'wallet' }, undefined, NOW);
  expect(takePurchaseLeftOpen(WALLET, NOW + 1000)).toEqual({ provider: { logged: 'Privy', name: undefined, route: 'wallet' }, held: undefined });
});

it('says nothing after two hours, or once it has been heard from', () => {
  markPurchaseOpened(WALLET, KRAKEN, undefined, NOW);
  expect(takePurchaseLeftOpen(WALLET, NOW + 2 * 60 * 60 * 1000)).toBeNull();
  markPurchaseOpened(WALLET, KRAKEN, undefined, NOW);
  forgetPurchaseOpened(WALLET);
  expect(takePurchaseLeftOpen(WALLET, NOW + 1000)).toBeNull();
});

it("is another wallet's business only, and ignores a note it cannot read", () => {
  markPurchaseOpened(WALLET, KRAKEN, undefined, NOW);
  expect(takePurchaseLeftOpen('0xabcdefabcdefabcdefabcdefabcdefabcdefabcd', NOW + 1000)).toBeNull();
  window.localStorage.setItem(`sd.purchaseOpened.${WALLET}.`, 'not json');
  expect(takePurchaseLeftOpen(WALLET, NOW + 1000)).toBeNull();
});
