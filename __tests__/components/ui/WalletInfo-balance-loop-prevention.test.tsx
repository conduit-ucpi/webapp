/**
 * Regression: WalletInfo must not re-fetch the token balance on every render.
 *
 * The RPC refactor moved WalletInfo's inline balance read to
 * useSimpleEthers().getTokenBalance and (incorrectly) added that function to
 * the effect's dependency array. useSimpleEthers returns a FRESH object each
 * render, so the getTokenBalance reference changes every render — re-firing the
 * effect on every render (observed as "balance flashing / reloading several
 * times", and hammering downstream calls).
 *
 * This mirrors the existing
 * ContractAcceptance-infinite-loop-prevention.test.tsx pattern: rerender with a
 * NEW getTokenBalance reference and assert the balance fetch does NOT re-fire.
 * The fix is to depend on the primitive inputs (address/token/rpcUrl), not the
 * function identity.
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react';
import WalletInfo from '@/components/ui/WalletInfo';
import { useAuth } from '@/components/auth';
import { useConfig } from '@/components/auth/ConfigProvider';
import { useSimpleEthers } from '@/hooks/useSimpleEthers';

jest.mock('@/components/auth', () => ({
  useAuth: jest.fn(),
}));
jest.mock('@/components/auth/ConfigProvider', () => ({
  useConfig: jest.fn(),
}));
jest.mock('@/hooks/useSimpleEthers', () => ({
  useSimpleEthers: jest.fn(),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseConfig = useConfig as jest.MockedFunction<typeof useConfig>;
const mockUseSimpleEthers = useSimpleEthers as jest.MockedFunction<typeof useSimpleEthers>;

const ADDRESS = '0x1234567890123456789012345678901234567890';
const TOKEN = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';

const baseConfig = {
  chainId: 8453,
  rpcUrl: 'https://mainnet.base.org',
  usdcContractAddress: TOKEN,
  tokenSymbol: 'USDC',
  defaultToken: { address: TOKEN, symbol: 'USDC', decimals: 6, name: 'USD Coin' },
};

describe('WalletInfo - balance fetch loop prevention', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { walletAddress: ADDRESS }, address: ADDRESS } as any);
    mockUseConfig.mockReturnValue({ config: baseConfig } as any);
  });

  it('does not re-fetch balance when getTokenBalance reference changes across renders', async () => {
    const firstGetTokenBalance = jest.fn().mockResolvedValue('1.5');
    mockUseSimpleEthers.mockReturnValue({ getTokenBalance: firstGetTokenBalance } as any);

    const { rerender } = render(<WalletInfo />);

    await waitFor(() => {
      expect(firstGetTokenBalance).toHaveBeenCalled();
    });
    const initialCallCount = firstGetTokenBalance.mock.calls.length;
    expect(initialCallCount).toBe(1);

    // Simulate useSimpleEthers returning a NEW function reference (it returns a
    // fresh object literal every render). Inputs (address/token/rpcUrl) unchanged.
    const secondGetTokenBalance = jest.fn().mockResolvedValue('1.5');
    mockUseSimpleEthers.mockReturnValue({ getTokenBalance: secondGetTokenBalance } as any);

    rerender(<WalletInfo />);

    // The effect must NOT re-fire just because the function identity changed.
    await waitFor(() => {
      expect(firstGetTokenBalance).toHaveBeenCalledTimes(initialCallCount);
    });
    expect(secondGetTokenBalance).not.toHaveBeenCalled();
  });

  it('re-fetches when a real input (token address) changes', async () => {
    const getTokenBalance = jest.fn().mockResolvedValue('1.5');
    mockUseSimpleEthers.mockReturnValue({ getTokenBalance } as any);

    const { rerender } = render(<WalletInfo tokenAddress={TOKEN} />);
    await waitFor(() => expect(getTokenBalance).toHaveBeenCalledTimes(1));

    const OTHER_TOKEN = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
    rerender(<WalletInfo tokenAddress={OTHER_TOKEN} />);

    await waitFor(() => expect(getTokenBalance).toHaveBeenCalledTimes(2));
    expect(getTokenBalance).toHaveBeenLastCalledWith(ADDRESS, OTHER_TOKEN);
  });
});
