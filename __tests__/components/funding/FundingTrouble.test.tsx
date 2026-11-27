/**
 * The help shown when buying stablecoins did not work, whichever company it was with: the next
 * thing to try first, then one tap on what stopped them. Every showing, reason and press is a
 * funding-event line.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import FundingTrouble from '@/components/funding/FundingTrouble';
import type { FundingTroubleApi, Seen, TroubleKind, TroubledProvider } from '@/hooks/useFundingTrouble';
import { reportFundingEvent } from '@/lib/reportFundingEvent';

jest.mock('@/lib/reportFundingEvent', () => ({ reportFundingEvent: jest.fn() }));
let mockPartner: unknown = null;
jest.mock('@/theme/BrandProvider', () => ({ usePartnerBrand: () => mockPartner }));

const WALLET = '0x1234567890abcdef1234567890abcdef12345678';
const reopen = jest.fn();
const CARD: TroubledProvider = { logged: 'Privy', route: 'wallet', reopen };
const KRAKEN: TroubledProvider = { logged: 'Kraken', name: 'Kraken', route: 'payment', reopen };
const chosen = { card: jest.fn(), coinbase: jest.fn(), kraken: jest.fn(), link: jest.fn() };
const onPurchased = jest.fn();
const api = (kind: TroubleKind | null, provider: TroubledProvider = CARD, seen?: Seen) =>
  ({
    current: kind ? { kind, provider, seen } : null,
    close: jest.fn(),
    awaitArrival: jest.fn(),
    opened: jest.fn(),
    notOpened: jest.fn(),
    cardEnded: jest.fn(),
    reportedBack: jest.fn(),
  }) as unknown as FundingTroubleApi & { close: jest.Mock; awaitArrival: jest.Mock };
const show = (kind: TroubleKind | null, provider: TroubledProvider = CARD, seen?: Seen) => {
  const trouble = api(kind, provider, seen);
  render(
    <FundingTrouble
      trouble={trouble}
      walletAddress={WALLET}
      token="USDC"
      ways={[
        { logged: 'Privy', name: 'Card, Apple Pay or Google Pay', onChoose: chosen.card },
        { logged: 'Coinbase', name: 'Coinbase', onChoose: chosen.coinbase },
        { logged: 'Kraken', name: 'Kraken', onChoose: chosen.kraken },
        { logged: 'Link', name: 'Link by Stripe', onChoose: chosen.link },
      ]}
      purchasedNote="We are looking for it."
      onPurchased={onPurchased}
    />
  );
  return trouble as FundingTroubleApi & { close: jest.Mock; awaitArrival: jest.Mock };
};
const logged = (event: string) =>
  (reportFundingEvent as jest.Mock).mock.calls.filter(([name]) => name === event).map(([, fields]) => fields.detail);

beforeEach(() => {
  jest.clearAllMocks();
  mockPartner = null;
  delete (window as any).Zipchat;
});

it('draws nothing when nothing is wrong', () => {
  show(null);
  expect(screen.queryByRole('region')).not.toBeInTheDocument();
  expect(reportFundingEvent).not.toHaveBeenCalled();
});

it('logs that it was shown, why, and for which company and route', () => {
  show('cancelled');
  expect(reportFundingEvent).toHaveBeenCalledWith('trouble-shown', { wallet: WALLET, provider: 'Privy', route: 'wallet', detail: 'cancelled' });
});

it('offers the two next-best ways, not the one that failed, and that one again by its own button', () => {
  const trouble = show('failed');
  expect(screen.getByRole('heading', { name: "That card purchase didn't go through" })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Try Card, Apple Pay or Google Pay' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Try Link by Stripe' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Try Coinbase' }));
  fireEvent.click(screen.getByRole('button', { name: 'Try Kraken' }));
  fireEvent.click(screen.getByRole('button', { name: 'Open the card window again' }));
  expect(chosen.coinbase).toHaveBeenCalled();
  expect(chosen.kraken).toHaveBeenCalled();
  expect(reopen).toHaveBeenCalled();
  expect(trouble.close).toHaveBeenCalledTimes(3);
  expect(logged('trouble-action')).toEqual(['try: Coinbase', 'try: Kraken', 'retry']);
});

it('logs the reason tapped and answers it', () => {
  show('cancelled');
  fireEvent.click(screen.getByRole('button', { name: 'My card was declined' }));
  expect(logged('trouble-reason')).toEqual(['declined']);
  expect(screen.getByRole('status')).toHaveTextContent(/A debit card is refused less often/);
  fireEvent.click(screen.getByRole('button', { name: 'The amount was too high' }));
  expect(screen.getByRole('status')).toHaveTextContent(/split this into smaller payments/);
  expect(logged('trouble-reason')).toEqual(['declined', 'limit']);
});

describe('"something else", which we have no answer for', () => {
  afterEach(() => {
    delete document.documentElement.dataset.feedbackScreen;
    delete (window.HTMLElement.prototype as any).scrollIntoView;
  });

  it('answers like the others, by saying to tell us with the chat or feedback below, with no box to type in', () => {
    document.documentElement.dataset.feedbackScreen = 'here';
    show('failed');
    fireEvent.click(screen.getByRole('button', { name: 'Something else' }));
    expect(logged('trouble-reason')).toEqual(['other']);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Please tell us what happened with one of the buttons just below: open a chat for an answer right away, or send us feedback.'
    );
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('makes those two buttons stand out, and brings them into view', () => {
    document.documentElement.dataset.feedbackScreen = 'here';
    const scrollIntoView = jest.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoView;
    show('failed');
    const reachUs = () => screen.getByRole('button', { name: 'Open chat' }).closest('[data-pointed-at]');
    expect(reachUs()).toBeNull();
    scrollIntoView.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Something else' }));
    expect(reachUs()).toHaveClass('ring-2');
    expect(reachUs()).toContainElement(screen.getByRole('button', { name: 'Send feedback' }));
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'nearest' });
    // Back to how they were when another reason is picked.
    fireEvent.click(screen.getByRole('button', { name: 'My card was declined' }));
    expect(reachUs()).toBeNull();
  });

  it('opens the chat with what they were doing already said', () => {
    const open = jest.fn();
    (window as any).Zipchat = { open };
    show('failed');
    fireEvent.click(screen.getByRole('button', { name: 'Something else' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open chat' }));
    expect(open).toHaveBeenCalledWith({ prefillMessage: "I tried to buy USDC with a card and it didn't work.", submit: true });
  });

  it("just thanks them on a partner's page, which has neither to point at", () => {
    mockPartner = { name: 'Partner' };
    show('failed');
    fireEvent.click(screen.getByRole('button', { name: 'Something else' }));
    expect(screen.getByRole('status')).toHaveTextContent("Thanks for telling us. We've noted it.");
  });
});

it("offers no chat on a partner's page, where the widget is not loaded", () => {
  mockPartner = { name: 'Partner' };
  show('failed');
  fireEvent.click(screen.getByRole('button', { name: 'Something else' }));
  expect(screen.queryByRole('button', { name: 'Open chat' })).not.toBeInTheDocument();
});

describe("back from a company's own page", () => {
  it('asks how it went there, by name, before anything else', () => {
    show('returned', KRAKEN);
    expect(screen.getByRole('heading', { name: 'Welcome back. Did your purchase at Kraken go through?' })).toBeInTheDocument();
    expect(screen.queryByText('What stopped you? One tap helps us fix it.')).not.toBeInTheDocument();
    expect(reportFundingEvent).toHaveBeenCalledWith('trouble-shown', { wallet: WALLET, provider: 'Kraken', route: 'payment', detail: 'returned' });
  });

  it("on a yes, has the page look for the money and says where it will show", () => {
    const trouble = show('returned', KRAKEN);
    fireEvent.click(screen.getByRole('button', { name: 'Yes, I paid' }));
    expect(trouble.awaitArrival).toHaveBeenCalledWith(KRAKEN);
    expect(onPurchased).toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('We are looking for it.');
    expect(logged('trouble-action')).toEqual(['purchased']);
  });

  it('on a no, goes on to the other ways, that company again, and the question', () => {
    show('returned', KRAKEN);
    fireEvent.click(screen.getByRole('button', { name: "No, it didn't work" }));
    // Their own word for it: no company told us it failed.
    expect(screen.getByRole('heading', { name: "Sorry Kraken didn't work for you" })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try Card, Apple Pay or Google Pay' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try Coinbase' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try Kraken' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Kraken again' })).toBeInTheDocument();
    expect(screen.getByText('What stopped you? One tap helps us fix it.')).toBeInTheDocument();
  });

  it('offers the same company among the ways when the page cannot open it again itself (after a reload)', () => {
    show('returned', { logged: 'Kraken', name: 'Kraken', route: 'wallet' });
    fireEvent.click(screen.getByRole('button', { name: "No, it didn't work" }));
    expect(screen.queryByRole('button', { name: 'Open Kraken again' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try Card, Apple Pay or Google Pay' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try Coinbase' })).toBeInTheDocument();
  });
});

it('tells a buyer whose purchase has not arrived what is happening, with a way to say it failed', () => {
  show('stuck');
  expect(screen.getByText(/Don't buy again unless you know you were not charged/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'It was declined or failed' }));
  expect(screen.getByRole('button', { name: 'My card was declined' })).toBeInTheDocument();
});

it('comes into view when it appears: the buyer is back wherever they pressed, which may be far below', () => {
  const scrollIntoView = jest.fn();
  window.HTMLElement.prototype.scrollIntoView = scrollIntoView;
  show('returned', KRAKEN);
  expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
  delete (window.HTMLElement.prototype as any).scrollIntoView;
});

describe('the other ways to reach us, under the help', () => {
  afterEach(() => {
    delete document.documentElement.dataset.feedbackScreen;
  });

  it('opens the feedback screen, or the chat, with what they were doing written in', () => {
    const open = jest.fn();
    (window as any).Zipchat = { open };
    document.documentElement.dataset.feedbackScreen = 'here';
    const asked = jest.fn();
    window.addEventListener('stabledrop:open-feedback', (event) => asked((event as CustomEvent).detail));
    show('returned', KRAKEN);
    fireEvent.click(screen.getByRole('button', { name: "No, it didn't work" }));
    fireEvent.click(screen.getByRole('button', { name: 'Send feedback' }));
    expect(asked).toHaveBeenCalledWith({ message: "I tried to buy USDC at Kraken and it didn't work." });
    fireEvent.click(screen.getByRole('button', { name: 'Open chat' }));
    expect(open).toHaveBeenCalledWith({ prefillMessage: "I tried to buy USDC at Kraken and it didn't work.", submit: true });
    expect(logged('trouble-action')).toEqual(['not-purchased', 'feedback', 'chat']);
  });

  it('is under a purchase that arrived short too, and not under the question of how it went', () => {
    document.documentElement.dataset.feedbackScreen = 'here';
    show('short', { logged: 'Kraken', name: 'Kraken', route: 'wallet', reopen }, { held: 19.2, needed: 20 });
    expect(screen.getByRole('button', { name: 'Send feedback' })).toBeInTheDocument();
  });

  it('does not ask how it went and offer feedback in the same breath', () => {
    document.documentElement.dataset.feedbackScreen = 'here';
    show('returned', KRAKEN);
    expect(screen.queryByRole('button', { name: 'Send feedback' })).not.toBeInTheDocument();
  });

  it("offers neither on a partner's page, which has no feedback screen and no chat", () => {
    mockPartner = { name: 'Partner' };
    show('failed');
    expect(screen.queryByRole('button', { name: 'Send feedback' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open chat' })).not.toBeInTheDocument();
  });
});

it('closes', () => {
  const trouble = show('cancelled');
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(trouble.close).toHaveBeenCalled();
});

describe('when the page looked before saying anything', () => {
  const WALLET_KRAKEN: TroubledProvider = { logged: 'Kraken', name: 'Kraken', route: 'wallet', reopen };

  it('says a purchase arrived short by how much, offers that company again and the others, and asks nothing', () => {
    show('short', WALLET_KRAKEN, { held: 19.2, needed: 20 });
    expect(screen.getByRole('heading', { name: 'Your purchase arrived, but it is 0.80 USDC short' })).toBeInTheDocument();
    expect(screen.getByText(/Your wallet now has 19.20 USDC, and this payment needs 20.00/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Kraken again' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try Coinbase' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Yes, I paid' })).not.toBeInTheDocument();
    expect(screen.queryByText('What stopped you? One tap helps us fix it.')).not.toBeInTheDocument();
    expect(logged('trouble-shown')).toEqual(['short: 19.20 of 20.00']);
  });

  it("for a purchase straight into the payment, says to send the rest to the same address", () => {
    show('short', KRAKEN, { held: 19.2, needed: 20 });
    expect(screen.getByText(/The payment has received 19.20 of the 20.00 USDC it needs.*Send 0.80 USDC more to the same address/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try Coinbase' })).not.toBeInTheDocument();
  });

  // Said, not asked: the page looked, so it does not open by asking whether it went through.
  it('says it cannot see the purchase yet and what it found, and only then asks how it went', () => {
    const trouble = show('returned', WALLET_KRAKEN, { held: 2, needed: 20 });
    expect(screen.getByRole('heading', { name: "We can't see your purchase from Kraken yet" })).toBeInTheDocument();
    expect(screen.getByText('We checked your wallet: it has 2.00 of the 20.00 USDC this payment needs.')).toBeInTheDocument();
    expect(screen.getByText('How did it go at Kraken?')).toBeInTheDocument();
    expect(screen.queryByText(/Did your purchase/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: "I paid, it's on its way" }));
    expect(trouble.awaitArrival).toHaveBeenCalled();
    expect(logged('trouble-shown')).toEqual(['returned: 2.00 of 20.00']);
  });

  it('on a screen with no payment to measure against, says what the wallet holds', () => {
    show('returned', WALLET_KRAKEN, { held: 5 });
    expect(screen.getByText('We checked your wallet: it has 5.00 USDC, the same as before.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: "It didn't work" }));
    expect(screen.getByRole('heading', { name: "Sorry Kraken didn't work for you" })).toBeInTheDocument();
    expect(logged('trouble-shown')).toEqual(['returned: 5.00 held']);
  });

  it("says the same of a payment's own address", () => {
    show('returned', KRAKEN, { held: 0, needed: 20 });
    expect(screen.getByText("We checked the payment's address: it has received 0.00 of the 20.00 USDC it needs.")).toBeInTheDocument();
  });
});
