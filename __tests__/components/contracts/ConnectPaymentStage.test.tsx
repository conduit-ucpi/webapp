/**
 * TDD spec for ConnectPaymentStage — the connect/auth screen inner content
 * shared by contract-create and contract-pay. The inner markup was byte-identical
 * in both pages; only the OUTER wrapper (div className + Head) differed and stays
 * per-page.
 *
 * Behavior locked:
 *  - shows the qr-protection callout only when paymentMethod === 'qr'
 *  - heading + copy switch on paymentMethod (wallet vs qr/social)
 *  - renders ConnectWalletEmbedded with connectionMode derived from paymentMethod
 *    ('qr' → 'social-only', else 'default') and forwards onConnectSuccess
 *  - "Back to payment options" button fires onBack
 */

import { render } from '@testing-library/react';
import { screen, fireEvent } from '@testing-library/dom';
import ConnectPaymentStage from '@/components/contracts/ConnectPaymentStage';

// Mock the heavyweight auth component to a marker exposing its key props.
jest.mock('@/components/auth/ConnectWalletEmbedded', () => {
  return function MockConnectWalletEmbedded(props: any) {
    return (
      <button data-testid="connect-embedded" data-connection-mode={props.connectionMode} onClick={props.onSuccess}>
        connect
      </button>
    );
  };
});

describe('ConnectPaymentStage', () => {
  it('shows the qr protection callout only for the qr method', () => {
    const { rerender } = render(
      <ConnectPaymentStage paymentMethod="qr" onBack={jest.fn()} onConnectSuccess={jest.fn()} />
    );
    expect(screen.getByText(/Sign in to protect your payment/)).toBeInTheDocument();

    rerender(<ConnectPaymentStage paymentMethod="wallet" onBack={jest.fn()} onConnectSuccess={jest.fn()} />);
    expect(screen.queryByText(/Sign in to protect your payment/)).toBeNull();
  });

  it('shows wallet-specific heading and copy for the wallet method', () => {
    render(<ConnectPaymentStage paymentMethod="wallet" onBack={jest.fn()} onConnectSuccess={jest.fn()} />);
    expect(screen.getByText('Connect Your Wallet')).toBeInTheDocument();
    expect(screen.getByText('Connect your wallet to complete the payment.')).toBeInTheDocument();
  });

  it('shows sign-in heading and copy for the qr method', () => {
    render(<ConnectPaymentStage paymentMethod="qr" onBack={jest.fn()} onConnectSuccess={jest.fn()} />);
    expect(screen.getByText('Sign In to Continue')).toBeInTheDocument();
    expect(screen.getByText('Sign in with your email or wallet to proceed.')).toBeInTheDocument();
  });

  it('passes connectionMode="social-only" to ConnectWalletEmbedded for qr', () => {
    render(<ConnectPaymentStage paymentMethod="qr" onBack={jest.fn()} onConnectSuccess={jest.fn()} />);
    expect(screen.getByTestId('connect-embedded').getAttribute('data-connection-mode')).toBe('social-only');
  });

  it('passes connectionMode="default" to ConnectWalletEmbedded for wallet', () => {
    render(<ConnectPaymentStage paymentMethod="wallet" onBack={jest.fn()} onConnectSuccess={jest.fn()} />);
    expect(screen.getByTestId('connect-embedded').getAttribute('data-connection-mode')).toBe('default');
  });

  it('forwards the connect success callback', () => {
    const onConnectSuccess = jest.fn();
    render(<ConnectPaymentStage paymentMethod="wallet" onBack={jest.fn()} onConnectSuccess={onConnectSuccess} />);
    fireEvent.click(screen.getByTestId('connect-embedded'));
    expect(onConnectSuccess).toHaveBeenCalled();
  });

  it('fires onBack from the "Back to payment options" button', () => {
    const onBack = jest.fn();
    render(<ConnectPaymentStage paymentMethod="wallet" onBack={onBack} onConnectSuccess={jest.fn()} />);
    fireEvent.click(screen.getByText('Back to payment options'));
    expect(onBack).toHaveBeenCalled();
  });
});
