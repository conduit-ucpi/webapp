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
jest.mock('@/lib/rpc/RpcClient', () => ({
  RpcClient: jest.fn().mockImplementation(() => ({
    getEscrowTerms,
    getContractState,
    getTokenBalance,
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
