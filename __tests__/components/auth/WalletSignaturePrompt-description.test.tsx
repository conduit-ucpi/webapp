/**
 * The notice over the wallet prompt uses the caller's own sentence when there is one: it can
 * name the seller and what happens to the money, where the calldata can only give an address.
 */
import { render, screen } from '@testing-library/react';
import WalletSignaturePrompt from '@/components/auth/WalletSignaturePrompt';

const SAYS = 'Pay 10 USDC into the payment contract for seller@example.com. It is released to them straight away.';

describe('WalletSignaturePrompt', () => {
  it("says the caller's sentence, and that approving is final", () => {
    render(<WalletSignaturePrompt prompt={{ kind: 'transaction', summary: 'sending 10.0 USDC to 0x7b0e…F51B', walletDescription: SAYS }} />);
    expect(screen.getByRole('status')).toHaveTextContent(`This one moves funds. ${SAYS} Approving is final.`);
    expect(screen.getByRole('status')).not.toHaveTextContent('0x7b0e');
  });

  it('falls back to what the calldata says when no sentence was given', () => {
    render(<WalletSignaturePrompt prompt={{ kind: 'transaction', summary: 'sending 10.0 USDC to 0x7b0e…F51B' }} />);
    expect(screen.getByRole('status')).toHaveTextContent('You are sending 10.0 USDC to 0x7b0e…F51B. Approving is final.');
  });

  it('does not say funds move, or that approving is final, for a step that moves nothing', () => {
    const open = 'Step 1 of 2: open a dispute on your payment for "Logo design". No money moves yet.';
    render(<WalletSignaturePrompt prompt={{ kind: 'transaction', summary: 'submitting a transaction to 0x7b0e…F51B', walletDescription: open, movesFunds: false }} />);
    expect(screen.getByRole('status')).toHaveTextContent(`Check your wallet.${open}`);
    expect(screen.getByRole('status')).not.toHaveTextContent('This one moves funds');
    expect(screen.getByRole('status')).not.toHaveTextContent('Approving is final');
  });

  it('still warns when a step said to move nothing gives no sentence of its own', () => {
    render(<WalletSignaturePrompt prompt={{ kind: 'transaction', summary: 'submitting a transaction to 0x7b0e…F51B', movesFunds: false }} />);
    expect(screen.getByRole('status')).toHaveTextContent('This one moves funds.');
  });
});
