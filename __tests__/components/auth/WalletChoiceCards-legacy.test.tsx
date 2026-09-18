/**
 * The "old wallet" tick box: shown only where a legacy provider exists, and when ticked the
 * same email/social button signs in through it.
 */

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import WalletChoiceCards from '@/components/auth/WalletChoiceCards';

const mockConnect = jest.fn(async () => ({ success: true, address: '0xabc', capabilities: {} }));
const mockSetConnectionMode = jest.fn().mockResolvedValue(undefined);
let legacyAvailable = true;

jest.mock('@/components/auth', () => ({
  useAuth: () => ({
    user: null,
    isLoading: false,
    isConnected: false,
    address: null,
    connect: mockConnect,
    setConnectionMode: mockSetConnectionMode,
    requestAuthentication: jest.fn(),
    canConnectLegacyWallet: () => legacyAvailable,
  }),
}));

jest.mock('@/lib/auth/magicReachability', () => ({ isMagicReachable: jest.fn().mockResolvedValue(true) }));
jest.mock('@/utils/mobileLogger', () => ({
  mLog: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), forceFlush: jest.fn().mockResolvedValue(undefined) },
}));

beforeEach(() => {
  jest.clearAllMocks();
  legacyAvailable = true;
});

it('offers the tick box only where an old wallet route exists', () => {
  const { unmount } = render(<WalletChoiceCards />);
  expect(screen.getByRole('checkbox')).toBeInTheDocument();
  unmount();

  legacyAvailable = false;
  render(<WalletChoiceCards />);
  expect(screen.queryByRole('checkbox')).toBeNull();
});

it('signs in the ordinary way when the box is not ticked', async () => {
  render(<WalletChoiceCards />);

  fireEvent.click(screen.getByText('Continue with email or social login'));

  await waitFor(() => expect(mockConnect).toHaveBeenCalledTimes(1));
  expect(mockConnect).toHaveBeenCalledWith(undefined);
});

it('signs in through the legacy provider when the box is ticked, still social-only', async () => {
  render(<WalletChoiceCards />);

  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByText('Continue with email or social login'));

  await waitFor(() => expect(mockConnect).toHaveBeenCalledTimes(1));
  expect(mockConnect).toHaveBeenCalledWith({ legacyWallet: true });
  expect(mockSetConnectionMode).toHaveBeenCalledWith('social-only');
});

it('never routes the advanced wallet connection through the legacy provider', async () => {
  render(<WalletChoiceCards />);

  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByText('Advanced wallet connection'));

  await waitFor(() => expect(mockConnect).toHaveBeenCalledTimes(1));
  expect(mockConnect).toHaveBeenCalledWith(undefined);
});
