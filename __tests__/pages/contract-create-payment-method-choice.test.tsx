/**
 * Integration test for the payment-method-choice seam in contract-create.tsx.
 *
 * The wallet/QR choice cards were extracted into <PaymentMethodChoice> (unit-
 * tested separately). The component test proves the component works; THIS test
 * proves the PAGE is wired to it correctly — i.e. that picking a method on the
 * rendered page actually advances the flow. No prior page-level test covered
 * this: they all mock useAuth as connected, which renders straight into the
 * form and skips the choice screen entirely.
 *
 * Behavior locked:
 *  - when NOT connected, the page shows the wallet + QR choice cards
 *  - clicking the wallet card advances to the connect/auth stage (wallet copy)
 *  - clicking the QR card advances to the connect/auth stage (sign-in copy)
 *
 * If the extraction's onSelect={setPaymentMethod} wiring regresses, these
 * assertions fail because the page never leaves the choice screen.
 */

import { render } from '@testing-library/react';
import { screen, fireEvent } from '@testing-library/dom';
import { useRouter } from 'next/router';
import ContractCreate from '@/pages/contract-create';

jest.mock('next/router', () => ({ useRouter: jest.fn() }));

// NOT connected — this is what makes the page render the choice screen.
jest.mock('@/components/auth', () => ({
  useAuth: () => ({
    user: null,
    isLoading: false,
    isLoadingUserData: false,
    isConnected: false,
    address: null,
    disconnect: jest.fn(),
    authenticatedFetch: jest.fn(),
    refreshUserData: jest.fn(),
  }),
}));

jest.mock('@/components/auth/ConfigProvider', () => ({
  useConfig: () => ({
    config: {
      chainId: 8453,
      rpcUrl: 'https://mainnet.base.org',
      usdcContractAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      serviceLink: 'https://test.example.com',
    },
    isLoading: false,
  }),
}));

jest.mock('@/hooks/useSimpleEthers', () => ({
  useSimpleEthers: () => ({
    approveUSDC: jest.fn(),
    depositToContract: jest.fn(),
    depositFundsAsProxy: jest.fn(),
    getWeb3Service: jest.fn(),
    transferToContract: jest.fn(),
    getTokenBalance: jest.fn(),
  }),
}));

jest.mock('@/hooks/useContractValidation', () => ({
  useContractCreateValidation: () => ({
    errors: {},
    validateForm: jest.fn().mockReturnValue(true),
    clearErrors: jest.fn(),
  }),
}));

// Replace the heavyweight embedded-wallet UI inside ConnectPaymentStage with a
// marker that exposes the connectionMode prop, so we can confirm the page
// advanced to the connect stage AND which method was chosen.
jest.mock('@/components/auth/ConnectWalletEmbedded', () => {
  return function MockConnectWalletEmbedded(props: any) {
    return (
      <div data-testid="connect-stage" data-connection-mode={props.connectionMode}>
        connect
      </div>
    );
  };
});

describe('ContractCreate - payment-method choice wiring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({
      query: {},
      push: jest.fn(),
      pathname: '/contract-create',
      route: '/contract-create',
      asPath: '/contract-create',
    });
  });

  it('renders the wallet and QR choice cards when not connected', () => {
    render(<ContractCreate />);
    expect(screen.getByText('How would you like to pay?')).toBeInTheDocument();
    expect(screen.getByText('Connect my wallet')).toBeInTheDocument();
    expect(screen.getByText('Pay by link / QR code')).toBeInTheDocument();
    // Choice screen is showing, not the connect stage yet.
    expect(screen.queryByTestId('connect-stage')).toBeNull();
  });

  it('advances to the connect stage in WALLET mode when the wallet card is clicked', () => {
    render(<ContractCreate />);
    fireEvent.click(screen.getByText('Connect my wallet'));

    const stage = screen.getByTestId('connect-stage');
    expect(stage).toBeInTheDocument();
    // wallet method → default connection mode (per ConnectPaymentStage)
    expect(stage).toHaveAttribute('data-connection-mode', 'default');
    expect(screen.getByText('Connect Your Wallet')).toBeInTheDocument();
  });

  it('advances to the connect stage in QR mode when the QR card is clicked', () => {
    render(<ContractCreate />);
    fireEvent.click(screen.getByText('Pay by link / QR code'));

    const stage = screen.getByTestId('connect-stage');
    expect(stage).toBeInTheDocument();
    // qr method → social-only connection mode (per ConnectPaymentStage)
    expect(stage).toHaveAttribute('data-connection-mode', 'social-only');
    expect(screen.getByText('Sign In to Continue')).toBeInTheDocument();
  });
});
