/**
 * TDD spec for QrPaymentPanel — the QR-payment render block extracted from
 * contract-create.tsx and contract-pay.tsx. The markup was structurally
 * identical; the differences are leaf props:
 *   - create-step button label ('Generate Payment Link' vs 'Pay'), its disabled
 *     state, and an optional note (pay's same-address guard message)
 *   - the displayed amount (form.amount vs contract.amount/1e6)
 *   - the cancel handler (create: embed-aware handleCancel; pay: router.push)
 *   - the success message wording
 *
 * The QR mechanics come from a `qr` object shaped like useQrPayment's return.
 * Pure presentation: no fetching, no timers.
 */

import { render } from '@testing-library/react';
import { screen, fireEvent } from '@testing-library/dom';
import QrPaymentPanel from '@/components/contracts/QrPaymentPanel';

jest.mock('@/components/ui/LoadingSpinner', () => () => <div data-testid="loading-spinner" />);
jest.mock('@/components/ui/Button', () => {
  return function MockButton({ children, onClick, disabled }: any) {
    return <button onClick={onClick} disabled={disabled}>{children}</button>;
  };
});
jest.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value }: any) => <div data-testid="qr-code" data-value={value} />,
}));

const makeQr = (overrides = {}) => ({
  qrContractAddress: null as string | null,
  qrCountdown: 240,
  qrPaymentDetected: false,
  qrActivationStatus: 'idle' as const,
  isCreatingContract: false,
  createContract: jest.fn(),
  checkAndActivate: jest.fn(),
  buildEip681Uri: jest.fn(() => 'ethereum:0xToken@8453/transfer?address=0xEscrow&uint256=10000000'),
  formatCountdown: (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`,
  ...overrides,
});

const baseProps = (qr: any) => ({
  qr,
  networkName: 'Base',
  tokenSymbol: 'USDC',
  amountInTokens: 10,
  isMobileDevice: false,
  copiedAddress: false,
  onCopyAddress: jest.fn(),
  createButtonLabel: 'Generate Payment Link',
  createDisabled: false,
  createNote: undefined as string | undefined,
  onCancel: jest.fn(),
  successMessage: 'Your payment has been verified. Redirecting...',
});

describe('QrPaymentPanel', () => {
  describe('step 1: create contract', () => {
    it('shows the create button with the supplied label and fires createContract', () => {
      const qr = makeQr();
      const props = baseProps(qr);
      render(<QrPaymentPanel {...props} />);
      const btn = screen.getByText('Generate Payment Link');
      fireEvent.click(btn);
      expect(qr.createContract).toHaveBeenCalled();
    });

    it('disables the create button and shows the note when createDisabled + createNote', () => {
      const qr = makeQr();
      render(<QrPaymentPanel {...baseProps(qr)} createButtonLabel="Pay" createDisabled createNote="Cannot pay yourself" />);
      expect((screen.getByText('Pay') as HTMLButtonElement).disabled).toBe(true);
      expect(screen.getByText('Cannot pay yourself')).toBeInTheDocument();
    });

    it('shows a creating spinner while isCreatingContract', () => {
      const qr = makeQr({ isCreatingContract: true });
      render(<QrPaymentPanel {...baseProps(qr)} />);
      expect(screen.getByText('Creating contract...')).toBeInTheDocument();
    });
  });

  describe('step 2: QR + instructions (address present, not yet success)', () => {
    const qr = () => makeQr({ qrContractAddress: '0xEscrow', qrActivationStatus: 'idle' });

    it('renders the QR code with the EIP-681 uri on desktop', () => {
      render(<QrPaymentPanel {...baseProps(qr())} isMobileDevice={false} />);
      const code = screen.getByTestId('qr-code');
      expect(code.getAttribute('data-value')).toContain('ethereum:');
    });

    it('shows the deep-link button instead of a QR code on mobile', () => {
      render(<QrPaymentPanel {...baseProps(qr())} isMobileDevice={true} />);
      expect(screen.queryByTestId('qr-code')).toBeNull();
      expect(screen.getByText('Open in Wallet App')).toBeInTheDocument();
    });

    it('shows the pay-to address and copies it on click', () => {
      const props = baseProps(qr());
      render(<QrPaymentPanel {...props} />);
      fireEvent.click(screen.getByText('Copy'));
      expect(props.onCopyAddress).toHaveBeenCalledWith('0xEscrow');
    });

    it('renders network, token, and amount in the instructions', () => {
      render(<QrPaymentPanel {...baseProps(qr())} networkName="Base" tokenSymbol="USDC" amountInTokens={10} />);
      expect(screen.getByText('Base')).toBeInTheDocument();
      // amount appears formatted to 4dp
      expect(screen.getAllByText(/10\.0000 USDC/).length).toBeGreaterThan(0);
    });

    it('shows the countdown and fires checkAndActivate from "I have paid"', () => {
      const q = qr();
      render(<QrPaymentPanel {...baseProps(q)} />);
      expect(screen.getByText(/4:00/)).toBeInTheDocument();
      fireEvent.click(screen.getByText('I have paid'));
      expect(q.checkAndActivate).toHaveBeenCalled();
    });

    it('fires onCancel from the cancel button', () => {
      const props = baseProps(qr());
      render(<QrPaymentPanel {...props} />);
      fireEvent.click(screen.getByText('Cancel'));
      expect(props.onCancel).toHaveBeenCalled();
    });

    it('shows the payment-detected banner when qrPaymentDetected', () => {
      render(<QrPaymentPanel {...baseProps(makeQr({ qrContractAddress: '0xEscrow', qrPaymentDetected: true }))} />);
      expect(screen.getByText('Payment detected! Verifying...')).toBeInTheDocument();
    });
  });

  describe('success state', () => {
    it('shows the success message and not the QR step', () => {
      const qr = makeQr({ qrContractAddress: '0xEscrow', qrActivationStatus: 'success' });
      render(<QrPaymentPanel {...baseProps(qr)} successMessage="Done. Redirecting to dashboard..." />);
      expect(screen.getByText('Payment Confirmed!')).toBeInTheDocument();
      expect(screen.getByText('Done. Redirecting to dashboard...')).toBeInTheDocument();
      expect(screen.queryByText('I have paid')).toBeNull();
    });
  });
});
