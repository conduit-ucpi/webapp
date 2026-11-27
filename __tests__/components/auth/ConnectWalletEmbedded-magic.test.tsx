/**
 * The sign-in card checks Magic is reachable only when this sign-in goes through Magic (Reown).
 *
 * ⚠️ WHY. With Privy live, the card still probed tee.express.magiclabs.com for every visitor. Where
 *    a network blocked it, the card reported a Magic failure (a false alert) and switched Privy to
 *    wallet-only, hiding its email and Google login, which never needed Magic.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import ConnectWalletEmbedded from '@/components/auth/ConnectWalletEmbedded';
import { useAuth } from '@/components/auth';
import { isMagicReachable } from '@/lib/auth/magicReachability';
import { reportAuthFailure } from '@/lib/auth/reportAuthFailure';

jest.mock('@/components/auth', () => ({ useAuth: jest.fn() }));
jest.mock('@/lib/auth/magicReachability', () => ({ isMagicReachable: jest.fn() }));
jest.mock('@/lib/auth/reportAuthFailure', () => ({ reportAuthFailure: jest.fn() }));
jest.mock('@/utils/mobileLogger', () => ({
  mLog: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), forceFlush: jest.fn().mockResolvedValue(undefined) },
}));

const mockUseAuth = useAuth as jest.Mock;
const mockReachable = isMagicReachable as jest.Mock;
const signInUsesMagic = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  sessionStorage.clear();
  mockReachable.mockResolvedValue(false); // Magic blocked on this network
  mockUseAuth.mockReturnValue({
    user: null,
    isLoading: false,
    connect: jest.fn(),
    isConnected: false,
    address: null,
    requestAuthentication: jest.fn(),
    setConnectionMode: jest.fn(),
    signInUsesMagic,
  });
});

it('does not check Magic, report it, or warn about it when the sign-in does not use it (Privy)', async () => {
  signInUsesMagic.mockReturnValue(false);
  render(<ConnectWalletEmbedded />);
  await new Promise((r) => setTimeout(r, 0));
  expect(signInUsesMagic).toHaveBeenCalledWith(false);
  expect(mockReachable).not.toHaveBeenCalled();
  expect(reportAuthFailure).not.toHaveBeenCalled();
  expect(screen.queryByText(/magiclabs\.com/)).toBeNull();
});

it('checks, reports and warns when the "old wallet" sign-in goes through Magic and it is blocked', async () => {
  signInUsesMagic.mockImplementation((legacy: boolean) => legacy);
  render(<ConnectWalletEmbedded legacyWallet />);
  await waitFor(() => expect(reportAuthFailure).toHaveBeenCalledWith('magic-blocked', 'pre-flight', expect.any(String)));
  expect(mockReachable).toHaveBeenCalledTimes(1);
  expect(screen.getByText('magiclabs.com')).toBeInTheDocument();
});
