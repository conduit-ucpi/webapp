/**
 * Inside a partner's iframe the email/social card cannot offer Google or Apple (they refuse to
 * render in a frame), so it says "email" and links the same page in a new tab, where they work.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import WalletChoiceCards from '@/components/auth/WalletChoiceCards';

let framed = false;
jest.mock('@/utils/deviceDetection', () => ({
  ...jest.requireActual('@/utils/deviceDetection'),
  isInIframe: () => framed,
}));

jest.mock('@/components/auth', () => ({
  useAuth: () => ({
    user: null,
    isLoading: false,
    isConnected: false,
    address: null,
    connect: jest.fn(),
    setConnectionMode: jest.fn().mockResolvedValue(undefined),
    requestAuthentication: jest.fn(),
    canConnectLegacyWallet: () => false,
  }),
}));

jest.mock('@/lib/auth/magicReachability', () => ({ isMagicReachable: jest.fn().mockResolvedValue(true) }));
jest.mock('@/utils/mobileLogger', () => ({
  mLog: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), forceFlush: jest.fn().mockResolvedValue(undefined) },
}));

afterEach(() => {
  framed = false;
  window.history.replaceState(null, '', '/');
});

it('offers email and social with no new-tab link at the top level', () => {
  render(<WalletChoiceCards />);
  expect(screen.getByRole('button', { name: 'Continue with email or social login' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /new tab/i })).not.toBeInTheDocument();
});

it('offers email, and this page in a new tab, inside a frame', async () => {
  framed = true;
  window.history.replaceState(null, '', '/create/?b=escrow-me');
  render(<WalletChoiceCards />);

  expect(await screen.findByRole('button', { name: 'Continue with email' })).toBeInTheDocument();
  const link = screen.getByRole('link', { name: 'Prefer Google or Apple? Open in a new tab' });
  // Same URL, so the partner's ?b= brand carries into the tab.
  expect(link).toHaveAttribute('href', 'http://localhost/create/?b=escrow-me');
  expect(link).toHaveAttribute('target', '_blank');
  expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
});
