/**
 * Test: /create page should load with wallet connection only (no backend auth required)
 *
 * REQUIREMENT: After connecting a wallet via WalletConnect (or any provider),
 * the /create page should display the CreateContractWizard even if there's no
 * backend SIWE session (user is null).
 *
 * This test verifies that wallet connection alone is sufficient to access the page.
 */

import { render, screen } from '@testing-library/react';
import CreatePage from '@/pages/create';

// Mock the auth hook
jest.mock('@/components/auth', () => ({
  useAuth: jest.fn(),
}));

// Mock CreateContractWizard component
jest.mock('@/components/contracts/CreateContractWizard', () => {
  return function MockCreateContractWizard() {
    return <div data-testid="create-contract-wizard">Create Contract Wizard</div>;
  };
});

// Mock ConnectWalletEmbedded component
jest.mock('@/components/auth/ConnectWalletEmbedded', () => {
  return function MockConnectWalletEmbedded() {
    return <div data-testid="connect-wallet-button">Connect Wallet</div>;
  };
});

// Mock Skeleton component
jest.mock('@/components/ui/Skeleton', () => {
  return function MockSkeleton({ className }: { className?: string }) {
    return <div data-testid="skeleton" className={className}></div>;
  };
});

describe('CreatePage - Wallet-Only Access', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should show loading state when auth is loading', () => {
    const { useAuth } = require('@/components/auth');
    useAuth.mockReturnValue({
      user: null,
      isLoading: true,
      isConnected: false,
      address: null,
    });

    render(<CreatePage />);

    // Should show skeleton loading state
    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
  });

  it('should show "Connect Your Wallet" when no wallet is connected', () => {
    const { useAuth } = require('@/components/auth');
    useAuth.mockReturnValue({
      user: null,
      isLoading: false,
      isConnected: false,
      address: null,
    });

    render(<CreatePage />);

    // Should show connect wallet UI
    expect(screen.getByText('Connect Your Wallet')).toBeInTheDocument();
    expect(screen.getByTestId('connect-wallet-button')).toBeInTheDocument();
  });

  it('SHOULD FAIL: should show CreateContractWizard when wallet is connected but no backend user (SIWE session)', () => {
    const { useAuth } = require('@/components/auth');

    // Simulate: WalletConnect connected, but no SIWE backend session yet
    useAuth.mockReturnValue({
      user: null, // No backend user (no SIWE session)
      isLoading: false,
      isConnected: true, // Wallet IS connected
      address: '0xc9D0602A87E55116F633b1A1F95D083Eb115f942', // Valid address
    });

    render(<CreatePage />);

    // CURRENT BEHAVIOR: Shows "Connect Your Wallet" because !user is true
    // EXPECTED BEHAVIOR: Should show CreateContractWizard because wallet is connected

    // This assertion SHOULD PASS but currently FAILS (reproduces the bug)
    expect(screen.getByTestId('create-contract-wizard')).toBeInTheDocument();

    // This assertion currently passes but SHOULD FAIL (proves the bug exists)
    // expect(screen.getByText('Connect Your Wallet')).toBeInTheDocument();
  });

  it('should show CreateContractWizard when wallet is connected AND backend user exists', () => {
    const { useAuth } = require('@/components/auth');

    // Simulate: WalletConnect connected AND SIWE session exists
    useAuth.mockReturnValue({
      user: {
        userId: '123',
        email: 'test@example.com',
        walletAddress: '0xc9D0602A87E55116F633b1A1F95D083Eb115f942'
      },
      isLoading: false,
      isConnected: true,
      address: '0xc9D0602A87E55116F633b1A1F95D083Eb115f942',
    });

    render(<CreatePage />);

    // Should show the wizard when fully authenticated
    expect(screen.getByTestId('create-contract-wizard')).toBeInTheDocument();
  });
});
