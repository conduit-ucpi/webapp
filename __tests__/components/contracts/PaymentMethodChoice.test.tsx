/**
 * TDD spec for PaymentMethodChoice — the "How would you like to pay?" wallet/QR
 * card pair extracted from contract-create.tsx, where it appeared twice (the
 * pre-auth stage-1 choice and the post-create step-2 choice). The two copies were
 * byte-identical except for the wallet card's title/subtitle, so those are props.
 *
 * Behavior locked:
 *  - renders a wallet card and a QR card
 *  - wallet card uses the provided walletTitle / walletSubtitle
 *  - QR card copy is fixed ("Pay by link / QR code")
 *  - clicking the wallet card fires onSelect('wallet')
 *  - clicking the QR card fires onSelect('qr')
 */

import { render } from '@testing-library/react';
import { screen, fireEvent } from '@testing-library/dom';
import PaymentMethodChoice from '@/components/contracts/PaymentMethodChoice';

describe('PaymentMethodChoice', () => {
  it('renders the provided wallet title/subtitle and the fixed QR copy', () => {
    render(
      <PaymentMethodChoice
        walletTitle="Connect my wallet"
        walletSubtitle="Pay directly from your crypto wallet (MetaMask, Coinbase, etc.)"
        onSelect={jest.fn()}
      />
    );

    expect(screen.getByText('Connect my wallet')).toBeInTheDocument();
    expect(
      screen.getByText('Pay directly from your crypto wallet (MetaMask, Coinbase, etc.)')
    ).toBeInTheDocument();
    expect(screen.getByText('Pay by link / QR code')).toBeInTheDocument();
  });

  it('supports the post-create wallet copy variant', () => {
    render(
      <PaymentMethodChoice
        walletTitle="Pay with connected wallet"
        walletSubtitle="Transfer directly from your connected wallet"
        onSelect={jest.fn()}
      />
    );

    expect(screen.getByText('Pay with connected wallet')).toBeInTheDocument();
    expect(screen.getByText('Transfer directly from your connected wallet')).toBeInTheDocument();
  });

  it('fires onSelect("wallet") when the wallet card is clicked', () => {
    const onSelect = jest.fn();
    render(
      <PaymentMethodChoice
        walletTitle="Connect my wallet"
        walletSubtitle="sub"
        onSelect={onSelect}
      />
    );

    fireEvent.click(screen.getByText('Connect my wallet'));
    expect(onSelect).toHaveBeenCalledWith('wallet');
  });

  it('fires onSelect("qr") when the QR card is clicked', () => {
    const onSelect = jest.fn();
    render(
      <PaymentMethodChoice
        walletTitle="Connect my wallet"
        walletSubtitle="sub"
        onSelect={onSelect}
      />
    );

    fireEvent.click(screen.getByText('Pay by link / QR code'));
    expect(onSelect).toHaveBeenCalledWith('qr');
  });
});
