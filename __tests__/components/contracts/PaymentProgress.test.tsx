/**
 * TDD spec for PaymentProgress — the payment step-list render block extracted
 * verbatim from contract-create.tsx and contract-pay.tsx (the markup was
 * byte-for-byte identical in both).
 *
 * Pure presentation: given steps + a loadingMessage, render each step's label
 * with a status-appropriate icon and text color, and show the loadingMessage
 * line when present. No fetching, no state.
 */

import { render } from '@testing-library/react';
import { screen } from '@testing-library/dom';
import PaymentProgress, { PaymentStep } from '@/components/contracts/PaymentProgress';

// LoadingSpinner is rendered for the 'active' step; mock it to a marker.
jest.mock('@/components/ui/LoadingSpinner', () => {
  return function MockLoadingSpinner(props: any) {
    return <div data-testid="loading-spinner" className={props.className} />;
  };
});

const steps: PaymentStep[] = [
  { id: 'verify', label: 'Verifying wallet connection', status: 'completed' },
  { id: 'transfer', label: 'Transferring to escrow', status: 'active' },
  { id: 'confirm', label: 'Confirming on blockchain', status: 'pending' },
  { id: 'failed', label: 'A failed step', status: 'error' },
];

describe('PaymentProgress', () => {
  it('renders every step label', () => {
    render(<PaymentProgress steps={steps} loadingMessage="" />);
    expect(screen.getByText('Verifying wallet connection')).toBeInTheDocument();
    expect(screen.getByText('Transferring to escrow')).toBeInTheDocument();
    expect(screen.getByText('Confirming on blockchain')).toBeInTheDocument();
    expect(screen.getByText('A failed step')).toBeInTheDocument();
  });

  it('shows the spinner only for the active step', () => {
    render(<PaymentProgress steps={steps} loadingMessage="" />);
    // Exactly one active step → exactly one spinner.
    expect(screen.getAllByTestId('loading-spinner')).toHaveLength(1);
  });

  it('applies the completed text color to completed steps', () => {
    render(<PaymentProgress steps={steps} loadingMessage="" />);
    const completed = screen.getByText('Verifying wallet connection');
    expect(completed.className).toContain('text-green-700');
  });

  it('applies the active text color (and font-medium) to the active step', () => {
    render(<PaymentProgress steps={steps} loadingMessage="" />);
    const active = screen.getByText('Transferring to escrow');
    expect(active.className).toContain('text-blue-700');
    expect(active.className).toContain('font-medium');
  });

  it('applies the error text color to error steps', () => {
    render(<PaymentProgress steps={steps} loadingMessage="" />);
    const errored = screen.getByText('A failed step');
    expect(errored.className).toContain('text-red-700');
  });

  it('applies the muted text color to pending steps', () => {
    render(<PaymentProgress steps={steps} loadingMessage="" />);
    const pending = screen.getByText('Confirming on blockchain');
    expect(pending.className).toContain('text-secondary-500');
  });

  it('renders the loading message when provided', () => {
    render(<PaymentProgress steps={steps} loadingMessage="Step 2: Transferring funds..." />);
    expect(screen.getByText('Step 2: Transferring funds...')).toBeInTheDocument();
  });

  it('does not render a loading message line when it is empty', () => {
    const { container } = render(<PaymentProgress steps={steps} loadingMessage="" />);
    // The message paragraph carries the italic class; none should be present.
    expect(container.querySelector('p.italic')).toBeNull();
  });

  it('renders the "Payment Progress" heading', () => {
    render(<PaymentProgress steps={steps} loadingMessage="" />);
    expect(screen.getByText('Payment Progress')).toBeInTheDocument();
  });
});
