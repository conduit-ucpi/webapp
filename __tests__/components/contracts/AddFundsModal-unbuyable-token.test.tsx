/**
 * A token no onramp delivers (USDT on Base): the buying routes are greyed out and say so, and
 * sending tokens already held stays open. USDC is offered exactly as before.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import AddFundsModal from '@/components/contracts/AddFundsModal';

jest.mock('@/components/auth/ConfigProvider', () => ({
  useConfig: () => ({ config: { coinbaseProjectId: 'p', chainId: 8453 } }),
}));
const fundWallet = jest.fn();
jest.mock('@/components/auth/SimpleAuthProvider', () => ({
  useAuth: () => ({ canFundWallet: () => true, fundWallet }),
}));
jest.mock('@/lib/reportFundingEvent', () => ({ reportFundingEvent: jest.fn() }));

const modal = (tokenSymbol: string, extra: Record<string, unknown> = {}) => (
  <AddFundsModal
    isOpen
    onClose={jest.fn()}
    walletAddress="0x1234567890abcdef1234567890abcdef12345678"
    tokenAddress="0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2"
    tokenSymbol={tokenSymbol}
    tokenDecimals={6}
    chainId={8453}
    networkName="Base"
    shortfall={9.57}
    {...extra}
  />
);
const cardOption = () => screen.getByRole('button', { name: /Add funds with a card/ });
const coinbaseOption = () => screen.getByRole('button', { name: /Add from Coinbase/ });
const CANNOT = "Some external suppliers can't support USDT yet. If your option is greyed out, use USDT you already hold or use USDC instead";

describe('AddFundsModal for a token that cannot be bought', () => {
  it('greys out both buying routes for USDT, each with the reason', () => {
    render(modal('USDT'));
    expect(cardOption()).toBeDisabled();
    expect(coinbaseOption()).toBeDisabled();
    expect(screen.getAllByText(CANNOT)).toHaveLength(2);
  });

  it("gives that reason rather than Coinbase's country one", () => {
    render(modal('USDT', { coinbaseUnavailable: "Coinbase can't take card or bank payments in Venezuela" }));
    expect(screen.queryByText(/Venezuela/)).toBeNull();
  });

  it('keeps the transfer from another wallet open', () => {
    render(modal('USDT'));
    expect(screen.getByRole('button', { name: /Transfer from another wallet/i })).toBeEnabled();
  });

  describe('Kraken', () => {
    const krakenOption = () => screen.getByRole('button', { name: /Add from Kraken/ });
    let open: jest.SpyInstance;
    beforeEach(() => {
      open = jest.spyOn(window, 'open').mockImplementation(() => null);
    });
    afterEach(() => open.mockRestore());

    it('opens Kraken for USDC on Base, asking for its minimum when less is needed, to this wallet', () => {
      render(modal('USDC', { shortfall: 1.5 }));
      expect(screen.getByText(/Kraken's minimum purchase is 11 USD/)).toBeInTheDocument();
      fireEvent.click(krakenOption());

      const url = new URL(open.mock.calls[0][0]);
      expect(url.origin + url.pathname).toBe('https://ramp.kraken.com/entry');
      expect(url.searchParams.get('crypto')).toBe('USDC');
      expect(url.searchParams.get('network')).toBe('Base');
      expect(url.searchParams.get('amount')).toBe('11');
      expect(url.searchParams.get('amount_type')).toBe('crypto');
      expect(url.searchParams.get('wallet_address')).toBe('0x1234567890abcdef1234567890abcdef12345678');
      expect(open.mock.calls[0][2]).toContain('noopener');
    });

    it('asks for the shortfall when it is above the minimum', () => {
      render(modal('USDC', { shortfall: 32.391 }));
      fireEvent.click(krakenOption());
      expect(new URL(open.mock.calls[0][0]).searchParams.get('amount')).toBe('32.4');
    });

    it('shows the wallet to check against on Kraken', () => {
      render(modal('USDC'));
      expect(screen.getByText(/check the Base address is this wallet: 0x1234567890abcdef1234567890abcdef12345678/)).toBeInTheDocument();
    });

    it('is greyed out, with the reason, for a token Kraken does not deliver on this network', () => {
      render(modal('USDT'));
      expect(krakenOption()).toBeDisabled();
      expect(screen.getByText("Kraken can't deliver USDT on Base yet.")).toBeInTheDocument();
      fireEvent.click(krakenOption());
      expect(open).not.toHaveBeenCalled();
    });

    it('is greyed out on a network Kraken does not deliver to', () => {
      render(modal('USDC', { chainId: 1, networkName: 'Ethereum' }));
      expect(krakenOption()).toBeDisabled();
      expect(screen.getByText("Kraken can't deliver USDC on Ethereum yet.")).toBeInTheDocument();
    });
  });

  describe('Link (by Stripe)', () => {
    const linkOption = () => screen.getByRole('button', { name: /Add with Link/ });
    let open: jest.SpyInstance;
    const writeText = jest.fn().mockResolvedValue(undefined);
    beforeEach(() => {
      open = jest.spyOn(window, 'open').mockImplementation(() => null);
      writeText.mockClear();
      Object.assign(navigator, { clipboard: { writeText } });
    });
    afterEach(() => open.mockRestore());

    it('opens Link for the shortfall in tokens and copies this wallet to paste there', () => {
      render(modal('USDC', { shortfall: 9.571 }));
      fireEvent.click(linkOption());

      const url = new URL(open.mock.calls[0][0]);
      expect(url.origin).toBe('https://crypto.link.com');
      expect(Object.fromEntries(url.searchParams)).toEqual({
        destination_currency: 'usdc',
        destination_network: 'base',
        destination_amount: '9.58',
      });
      expect(writeText).toHaveBeenCalledWith('0x1234567890abcdef1234567890abcdef12345678');
      expect(screen.getByText(/Paste this wallet \(Base\), copied for you: 0x1234567890abcdef1234567890abcdef12345678/)).toBeInTheDocument();
    });

    it('is greyed out, with the reason, for a token Link does not deliver here', () => {
      render(modal('USDT'));
      expect(linkOption()).toBeDisabled();
      expect(screen.getByText("Link can't deliver USDT on Base yet.")).toBeInTheDocument();
    });
  });

  it('offers both buying routes for USDC, as before', () => {
    render(modal('USDC'));
    expect(cardOption()).toBeEnabled();
    expect(coinbaseOption()).toBeEnabled();
    expect(screen.queryByText(/can't support USDT yet/)).toBeNull();
  });
});
