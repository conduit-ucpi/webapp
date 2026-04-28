/**
 * Verifies that clicking "Make Payment" on a pending contract from the dashboard
 * navigates to /contract-pay?contractId=... instead of opening a modal.
 *
 * Two cases matter:
 * 1. Backend sends ctaType: 'ACCEPT_CONTRACT' → card emits action 'accept'
 * 2. Backend sends an unrecognized ctaType but still ctaVariant: 'action' →
 *    card falls back to action 'view-details'. For pending contracts we still
 *    want this to route to the pay page, not open the details modal.
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import EnhancedDashboard from '@/components/dashboard/EnhancedDashboard';
import { useAuth } from '@/components/auth';
import { useRouter } from 'next/router';

const pushMock = jest.fn();

jest.mock('next/router', () => ({
  useRouter: jest.fn(() => ({
    pathname: '/dashboard',
    push: pushMock,
  })),
}));

jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
});

jest.mock('@/components/auth', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/components/onboarding/ProgressChecklist', () => () => null);
jest.mock('@/components/contracts/ContractDetailsModal', () => () => (
  <div data-testid="contract-details-modal" />
));
jest.mock('@/components/contracts/DisputeManagementModal', () => () => null);

const PENDING_CONTRACT_ID = 'pending-contract-abc123';

function makePendingContractApiResponse(ctaType: string) {
  return [
    {
      contract: {
        id: PENDING_CONTRACT_ID,
        sellerEmail: 'seller@example.com',
        buyerEmail: 'buyer@example.com',
        amount: 1000000,
        currency: 'USDC',
        sellerAddress: '0xseller',
        // No chainAddress → treated as pending
        chainAddress: undefined,
        expiryTimestamp: Math.floor(Date.now() / 1000) + 86400,
        description: 'Test pending contract',
        createdAt: Math.floor(Date.now() / 1000),
        createdBy: '0xbuyer',
        state: 'OK',
        adminNotes: [],
      },
      ctaType,
      ctaLabel: 'Make Payment',
      ctaVariant: 'action',
    },
  ];
}

function mockAuthWithFetch(fetchImpl: jest.Mock) {
  (useAuth as jest.Mock).mockReturnValue({
    user: { walletAddress: '0xbuyer', email: 'buyer@example.com' },
    isLoading: false,
    isConnected: true,
    isAuthenticated: true,
    error: null,
    address: '0xbuyer',
    state: {
      isConnected: true,
      isLoading: false,
      isInitialized: true,
      isAuthenticated: true,
      address: '0xbuyer',
      providerName: 'reown',
      capabilities: null,
      error: null,
    },
    connect: jest.fn(),
    authenticateBackend: jest.fn(),
    requestAuthentication: jest.fn(),
    disconnect: jest.fn(),
    switchWallet: jest.fn(),
    getEthersProvider: jest.fn(),
    showWalletUI: jest.fn(),
    getProviderUserInfo: jest.fn(),
    authenticatedFetch: fetchImpl,
    hasVisitedBefore: jest.fn(),
    refreshUserData: jest.fn(),
    claimFunds: jest.fn(),
    raiseDispute: jest.fn(),
  });
}

describe('EnhancedDashboard — Make Payment routes to /contract-pay', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    pushMock.mockClear();
  });

  it('routes to /contract-pay when the pending contract CTA is ACCEPT_CONTRACT', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => makePendingContractApiResponse('ACCEPT_CONTRACT'),
    });
    mockAuthWithFetch(fetchImpl);

    render(<EnhancedDashboard />);

    const button = await waitFor(() => screen.getByRole('button', { name: /make payment/i }));
    fireEvent.click(button);

    expect(pushMock).toHaveBeenCalledWith(`/contract-pay?contractId=${PENDING_CONTRACT_ID}`);
  });

  it('routes to /contract-pay even when the backend sends an unrecognized ctaType (view-details fallback)', async () => {
    // The card maps unknown ctaType to action 'view-details'. For pending contracts
    // that should still mean "pay this", not "open the details modal".
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => makePendingContractApiResponse('SOME_NEW_PAY_CTA'),
    });
    mockAuthWithFetch(fetchImpl);

    render(<EnhancedDashboard />);

    const button = await waitFor(() => screen.getByRole('button', { name: /make payment/i }));
    fireEvent.click(button);

    expect(pushMock).toHaveBeenCalledWith(`/contract-pay?contractId=${PENDING_CONTRACT_ID}`);
  });
});
