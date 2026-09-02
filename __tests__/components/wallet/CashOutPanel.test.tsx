/**
 * Test: components/wallet/CashOutPanel
 *
 * This is the component that moves a user's money, so the tests are about when it
 * does and does not sign:
 *
 *  - it refuses an order whose chain or token is not ours, rather than signing
 *    through something that arrived from outside;
 *  - it raises the prompt by itself only when the user has just come back from
 *    Coinbase, and exactly once, so a rejected signature does not re-fire;
 *  - an order found on a cold page load waits for the user to ask.
 */

import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CashOutPanel from '@/components/wallet/CashOutPanel';
import { useConfig } from '@/components/auth/ConfigProvider';
import { useSimpleEthers } from '@/hooks/useSimpleEthers';
import { OFFRAMP_RETURN_MESSAGE } from '@/lib/coinbaseOfframp';

jest.mock('@/components/auth/ConfigProvider', () => ({
  useConfig: jest.fn(),
}));

jest.mock('@/hooks/useSimpleEthers', () => ({
  useSimpleEthers: jest.fn(),
}));

jest.mock('@/lib/coinbaseOfframp', () => ({
  ...jest.requireActual('@/lib/coinbaseOfframp'),
  openCoinbaseOfframp: jest.fn(),
}));

const mockRouter = {
  isReady: true,
  pathname: '/wallet',
  query: {} as Record<string, string>,
  replace: jest.fn().mockResolvedValue(true),
};

jest.mock('next/router', () => ({
  useRouter: () => mockRouter,
}));

import { openCoinbaseOfframp } from '@/lib/coinbaseOfframp';

const mockUseConfig = useConfig as jest.MockedFunction<typeof useConfig>;
const mockUseSimpleEthers = useSimpleEthers as jest.MockedFunction<typeof useSimpleEthers>;
const mockOpenOfframp = openCoinbaseOfframp as jest.MockedFunction<typeof openCoinbaseOfframp>;

const WALLET = '0x1234567890abcdef1234567890abcdef12345678';
const COINBASE_DEPOSIT = '0x9999999999999999999999999999999999999999';
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

const mockFundAndSend = jest.fn();

/** Mirrors the panel's poll cadence (5s x 24 attempts). */
const POLL_INTERVAL_MS = 5000;

const baseConfig: any = {
  chainId: 8453,
  rpcUrl: 'https://mainnet.base.org',
  coinbaseProjectId: 'proj-123',
  coinbaseNetwork: 'base',
  supportedTokens: [
    { symbol: 'USDC', address: USDC_ADDRESS, name: 'USD Coin', decimals: 6, isDefault: true },
  ],
  defaultToken: { symbol: 'USDC', address: USDC_ADDRESS, name: 'USD Coin', decimals: 6 },
};

function pendingOrder(overrides: Record<string, unknown> = {}) {
  return {
    transactionId: 'tx-1',
    toAddress: COINBASE_DEPOSIT,
    asset: 'USDC',
    network: 'base',
    amount: '25.00',
    currency: 'USDC',
    createdAt: new Date(Date.now() - 60_000).toISOString(),
    expiresAt: new Date(Date.now() + 29 * 60_000).toISOString(),
    ...overrides,
  };
}

function mockPendingResponse(pending: unknown) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ pending }),
  });
}

function renderPanel(props: Partial<React.ComponentProps<typeof CashOutPanel>> = {}) {
  return render(
    <CashOutPanel walletAddress={WALLET} balances={{ USDC: '132.4218' }} {...props} />
  );
}

/** Coinbase's popup finished; the return page tells the opener. */
async function fireReturnFromCoinbase() {
  await act(async () => {
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: OFFRAMP_RETURN_MESSAGE },
        origin: window.location.origin,
      })
    );
  });
}

describe('CashOutPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouter.query = {};
    mockUseConfig.mockReturnValue({ config: baseConfig, isLoading: false });
    mockUseSimpleEthers.mockReturnValue({ fundAndSendTransaction: mockFundAndSend } as any);
    mockFundAndSend.mockResolvedValue('0xtxhash');
    mockPendingResponse(null);
  });

  describe('when Coinbase is not configured', () => {
    it('renders nothing without a project id', async () => {
      mockUseConfig.mockReturnValue({
        config: { ...baseConfig, coinbaseProjectId: undefined },
        isLoading: false,
      });

      const { container } = renderPanel();

      expect(container).toBeEmptyDOMElement();
    });

    it('renders nothing without a network, rather than guessing a chain', async () => {
      mockUseConfig.mockReturnValue({
        config: { ...baseConfig, coinbaseNetwork: undefined },
        isLoading: false,
      });

      const { container } = renderPanel();

      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('starting a cash-out', () => {
    it('passes the configured chain and the chosen token to Coinbase', async () => {
      const user = userEvent.setup();
      renderPanel();

      await user.type(screen.getByLabelText(/amount/i), '25');
      await user.click(screen.getByRole('button', { name: /cash out usdc/i }));

      await waitFor(() => expect(mockOpenOfframp).toHaveBeenCalled());
      expect(mockOpenOfframp).toHaveBeenCalledWith(
        expect.objectContaining({
          walletAddress: WALLET,
          asset: 'USDC',
          network: 'base',
          presetCryptoAmount: 25,
        })
      );
    });

    it('will not start a cash-out for more than the wallet holds', async () => {
      const user = userEvent.setup();
      renderPanel();

      await user.type(screen.getByLabelText(/amount/i), '999');

      expect(screen.getByRole('button', { name: /cash out usdc/i })).toBeDisabled();
      expect(mockOpenOfframp).not.toHaveBeenCalled();
    });
  });

  describe('settling an order', () => {
    it('signs by itself when the user has just come back from Coinbase', async () => {
      renderPanel();
      mockPendingResponse(pendingOrder());

      await fireReturnFromCoinbase();

      await waitFor(() => expect(mockFundAndSend).toHaveBeenCalledTimes(1));

      const sent = mockFundAndSend.mock.calls[0][0];
      // An ERC20 transfer to Coinbase's address, sent to the token contract.
      expect(sent.to).toBe(USDC_ADDRESS);
      expect(sent.data.toLowerCase()).toContain(COINBASE_DEPOSIT.slice(2).toLowerCase());
      // 25.00 USDC at 6 decimals = 25000000 = 0x17d7840
      expect(sent.data.toLowerCase()).toContain('17d7840');
    });

    it('prompts only once per order, so a rejected signature does not re-fire', async () => {
      mockFundAndSend.mockRejectedValueOnce(new Error('User rejected the request'));
      renderPanel();
      mockPendingResponse(pendingOrder());

      await fireReturnFromCoinbase();
      await waitFor(() => expect(mockFundAndSend).toHaveBeenCalledTimes(1));

      await fireReturnFromCoinbase();

      await screen.findByText(/user rejected the request/i);
      expect(mockFundAndSend).toHaveBeenCalledTimes(1);
    });

    it('waits for the button when an order turns up on a cold page load', async () => {
      mockPendingResponse(pendingOrder());

      renderPanel();

      await screen.findByText(/finish your cash-out/i);
      expect(mockFundAndSend).not.toHaveBeenCalled();

      await userEvent.click(screen.getByRole('button', { name: /send 25\.00 usdc to coinbase/i }));

      await waitFor(() => expect(mockFundAndSend).toHaveBeenCalledTimes(1));
    });

    it('refuses an order for a different chain', async () => {
      renderPanel();
      mockPendingResponse(pendingOrder({ network: 'ethereum' }));

      await fireReturnFromCoinbase();

      await screen.findByText(/nothing has been sent/i);
      expect(mockFundAndSend).not.toHaveBeenCalled();
    });

    it('refuses an order in a token this wallet does not hold', async () => {
      renderPanel();
      mockPendingResponse(pendingOrder({ currency: 'DOGE', asset: 'DOGE' }));

      await fireReturnFromCoinbase();

      await screen.findByText(/nothing has been sent/i);
      expect(mockFundAndSend).not.toHaveBeenCalled();
    });

    it('refuses an order whose deposit address is not a valid address', async () => {
      renderPanel();
      mockPendingResponse(pendingOrder({ toAddress: 'not-an-address' }));

      await fireReturnFromCoinbase();

      await screen.findByText(/nothing has been sent/i);
      expect(mockFundAndSend).not.toHaveBeenCalled();
    });

    it('explains itself instead of spinning forever when no order turns up', async () => {
      jest.useFakeTimers({ advanceTimers: true });
      renderPanel();
      mockPendingResponse(null);

      await fireReturnFromCoinbase();
      expect(screen.getByText(/checking your cash-out with coinbase/i)).toBeInTheDocument();

      // Exhaust the poll window (24 attempts, 5s apart).
      // Each advance needs its own act() so the awaited fetch inside the tick
      // resolves before the next timer is scheduled.
      for (let i = 0; i < 26; i++) {
        await act(async () => {
          jest.advanceTimersByTime(POLL_INTERVAL_MS);
        });
      }

      expect(screen.getByText(/no cash-out is waiting to be sent/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /check again/i })).toBeInTheDocument();
      jest.useRealTimers();
    });

    it('names the statuses Coinbase reported when none are actionable', async () => {
      jest.useFakeTimers({ advanceTimers: true });
      renderPanel();
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ pending: null, seen: [{ status: 'SUCCESS', ageSeconds: 400 }] }),
      });

      await fireReturnFromCoinbase();
      // Each advance needs its own act() so the awaited fetch inside the tick
      // resolves before the next timer is scheduled.
      for (let i = 0; i < 26; i++) {
        await act(async () => {
          jest.advanceTimersByTime(POLL_INTERVAL_MS);
        });
      }

      expect(screen.getByText(/SUCCESS/)).toBeInTheDocument();
      jest.useRealTimers();
    });

    it('refreshes balances after a successful send', async () => {
      const onSent = jest.fn();
      renderPanel({ onSent });
      mockPendingResponse(pendingOrder());

      await fireReturnFromCoinbase();

      await waitFor(() => expect(onSent).toHaveBeenCalled());
    });
  });
});
