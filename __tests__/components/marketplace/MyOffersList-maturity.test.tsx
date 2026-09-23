/**
 * Maturity on the LP's own offers.
 *
 * It is the LP's primary risk metric — the remaining dispute window, the whole period during
 * which the position can still be taken from them — and it was only visible on the screen where
 * the bid was made, not on the list of bids they are holding.
 *
 * Two clocks appear on this row and confusing them is expensive: the OFFER lapses on one date,
 * the CASHFLOW matures on another. They are labelled distinctly for that reason.
 */

import { render, screen, waitFor } from '@testing-library/react';

const getEscrowTerms = jest.fn();
const getContractState = jest.fn();
const getTokenBalance = jest.fn();
const getPayoutAmount = jest.fn();
jest.mock('@/lib/rpc/RpcClient', () => ({
  RpcClient: jest.fn().mockImplementation(() => ({
    getEscrowTerms,
    getContractState,
    getTokenBalance,
    getPayoutAmount,
  })),
}));

const lpOffers = jest.fn();
jest.mock('@/hooks/useMarketplaceData', () => ({
  useLpOffers: () => lpOffers(),
  useRefreshFromChain: () => ({ refresh: jest.fn(), refreshing: false }),
}));
jest.mock('@/hooks/useMarketplaceActions', () => ({
  useMarketplaceActions: () => ({
    withdrawOffer: jest.fn(),
    releaseHoldback: jest.fn(),
    openOffer: jest.fn(),
  }),
}));
jest.mock('@/components/auth/ConfigProvider', () => ({
  useConfig: () => ({
    config: { tokenSymbol: 'USDC', rpcUrl: 'https://rpc.example' },
    isLoading: false,
  }),
}));

import MyOffersList from '@/components/marketplace/MyOffersList';

const ESCROW = '0xescrow1111111111111111111111111111111111';
// 2026-12-25T09:30:00Z — a date and a time, so a date-only render would be visibly wrong.
const MATURITY = Math.floor(Date.UTC(2026, 11, 25, 9, 30) / 1000);

const anOffer = (overrides = {}) => ({
  vaultAddress: '0xvault',
  escrowContract: ESCROW,
  lp: '0xlp',
  seller: '0xseller',
  token: '0xtoken',
  offerAmount: '90000000',
  netAmount: '79100000',
  fee: '900000',
  holdback: '0',
  offerExpiry: Math.floor(Date.now() / 1000) + 7200,
  status: 'OPEN',
  expired: false,
  lastEventAt: Math.floor(Date.now() / 1000),
  ...overrides,
});

const withOffers = (list: unknown[]) =>
  lpOffers.mockReturnValue({ data: list, loading: false, error: null, refetch: jest.fn() });

describe('MyOffersList — cashflow maturity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    getContractState.mockResolvedValue({ isClaimed: false });
    getTokenBalance.mockResolvedValue('0');
    getPayoutAmount.mockResolvedValue(BigInt(99_000_000));
  });

  it('shows when the cashflow matures', async () => {
    getEscrowTerms.mockResolvedValue({ expiryTimestamp: BigInt(MATURITY) });
    withOffers([anOffer()]);

    render(<MyOffersList lpAddress="0xlp" />);

    await waitFor(() => expect(screen.getByText(/Cashflow matures/)).toBeInTheDocument());
  });

  it('shows a time, not just a date', async () => {
    // "Matures on the 25th" is not enough to price a position that settles that morning.
    getEscrowTerms.mockResolvedValue({ expiryTimestamp: BigInt(MATURITY) });
    withOffers([anOffer()]);

    render(<MyOffersList lpAddress="0xlp" />);

    const line = await screen.findByText(/Cashflow matures/);
    expect(line.textContent).toMatch(/\d{1,2}:\d{2}/);
  });

  it('keeps the offer lapse and the cashflow maturity distinct', async () => {
    // Two different clocks on one row. A reader who merges them either abandons capital they
    // could have withdrawn, or expects it back months early.
    getEscrowTerms.mockResolvedValue({ expiryTimestamp: BigInt(MATURITY) });
    withOffers([anOffer()]);

    render(<MyOffersList lpAddress="0xlp" />);

    await waitFor(() => expect(screen.getByText(/Cashflow matures/)).toBeInTheDocument());
    expect(screen.getByText(/lapses in/i)).toBeInTheDocument();
  });

  it('says nothing rather than dating it to the epoch when the read fails', async () => {
    // A zero would render as 01/01/1970 — which looks like data, not like an error, on the
    // field the LP prices risk with.
    getEscrowTerms.mockRejectedValue(new Error('rpc down'));
    withOffers([anOffer()]);

    render(<MyOffersList lpAddress="0xlp" />);

    await waitFor(() => expect(getEscrowTerms).toHaveBeenCalled());
    expect(screen.queryByText(/Cashflow matures/)).not.toBeInTheDocument();
    expect(screen.queryByText(/1970/)).not.toBeInTheDocument();
  });
});


/**
 * What the position is worth, on the LP's own list.
 *
 * An LP holding several offers is judging them against each other and against everything else
 * they could do with the capital, and neither figure was on this screen: they could see what
 * they had bid but not what it collects, nor at what rate.
 */
describe('MyOffersList — payout and effective yield', () => {
  // 90 deposited, 99 collected, 30 days out.
  const IN_30_DAYS = Math.floor(Date.now() / 1000) + 30 * 86_400;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    getContractState.mockResolvedValue({ isClaimed: false });
    getTokenBalance.mockResolvedValue('0');
    getEscrowTerms.mockResolvedValue({ expiryTimestamp: BigInt(IN_30_DAYS) });
    getPayoutAmount.mockResolvedValue(BigInt(99_000_000));
  });

  it('shows what the position collects at maturity', async () => {
    withOffers([anOffer()]);

    render(<MyOffersList lpAddress="0xlp" />);

    await waitFor(() => expect(screen.getByText(/Collects/)).toBeInTheDocument());
    expect(screen.getByText(/\$99\.0000/)).toBeInTheDocument();
  });

  it('shows the effective yield', async () => {
    // 9 on 90 over 30 days = 10% for the period, ~121.7% annualised simple.
    withOffers([anOffer()]);

    render(<MyOffersList lpAddress="0xlp" />);

    await waitFor(() => expect(screen.getByText(/annualised/)).toBeInTheDocument());
    expect(screen.getByText('121.7%')).toBeInTheDocument();
  });

  it('says the amount was paid once accepted, not offered', async () => {
    // The money left the vault in the accepting transaction. "Offered" describes a bid that is
    // no longer outstanding, on the row where the LP looks to confirm their capital went.
    withOffers([anOffer({ status: 'ACCEPTED' })]);

    render(<MyOffersList lpAddress="0xlp" />);

    expect(await screen.findByText(/USDC paid/)).toBeInTheDocument();
    expect(screen.queryByText(/USDC offered/)).not.toBeInTheDocument();
  });

  it('still says offered while the bid is standing', async () => {
    withOffers([anOffer()]);

    render(<MyOffersList lpAddress="0xlp" />);

    expect(await screen.findByText(/USDC offered/)).toBeInTheDocument();
  });

  it('quotes both on an accepted offer, where the capital is still committed', async () => {
    withOffers([anOffer({ status: 'ACCEPTED' })]);

    render(<MyOffersList lpAddress="0xlp" />);

    await waitFor(() => expect(screen.getByText(/Collects/)).toBeInTheDocument());
    expect(screen.getByText(/annualised/)).toBeInTheDocument();
  });

  describe('positions that are no longer live', () => {
    // Quoting a return on these would suggest capital is still working when it is not.
    it('quotes nothing on a withdrawn offer', async () => {
      withOffers([anOffer({ status: 'WITHDRAWN' })]);

      render(<MyOffersList lpAddress="0xlp" />);

      await waitFor(() => expect(getPayoutAmount).toHaveBeenCalled());
      expect(screen.queryByText(/annualised/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Collects/)).not.toBeInTheDocument();
    });

    it('quotes nothing on a lapsed offer', async () => {
      withOffers([anOffer({ expired: true })]);

      render(<MyOffersList lpAddress="0xlp" />);

      await waitFor(() => expect(getPayoutAmount).toHaveBeenCalled());
      expect(screen.queryByText(/annualised/)).not.toBeInTheDocument();
    });
  });

  it('shows the payout without a yield when maturity could not be read', async () => {
    // The payout is a fact; the yield needs a period. Losing one should not hide the other.
    getEscrowTerms.mockRejectedValue(new Error('rpc down'));
    withOffers([anOffer()]);

    render(<MyOffersList lpAddress="0xlp" />);

    await waitFor(() => expect(screen.getByText(/Collects/)).toBeInTheDocument());
    expect(screen.queryByText(/annualised/)).not.toBeInTheDocument();
  });
});
