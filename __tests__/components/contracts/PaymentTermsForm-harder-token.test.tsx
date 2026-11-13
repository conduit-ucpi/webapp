/**
 * Choosing a token buyers struggle to get on exchanges says so, where it can still be changed.
 */
import { render, screen } from '@testing-library/react';
import PaymentTermsForm from '@/components/contracts/PaymentTermsForm';

jest.mock('@/components/ui/CurrencyAmountInput', () => () => null);
jest.mock('@/components/contracts/AmountGuidance', () => () => null);
jest.mock('@/components/contracts/ReleaseDateField', () => () => null);
jest.mock('@/components/contracts/AdvancedOptions', () => () => null);

const form = (overrides: Record<string, unknown> = {}) => (
  <PaymentTermsForm
    amount="10"
    onAmountChange={jest.fn()}
    payoutTimestamp={0}
    onPayoutTimestampChange={jest.fn()}
    description=""
    onDescriptionChange={jest.fn()}
    errors={{}}
    tokenSymbol="USDT"
    {...overrides}
  />
);

describe('PaymentTermsForm and a token that is harder to buy', () => {
  it('warns the seller on /create that buyers may struggle to get USDT', () => {
    render(form());
    expect(screen.getByRole('note')).toHaveTextContent(
      'USDT can be harder for buyers to get from exchanges than USDC. Unless your buyer already holds USDT, USDC is the easier choice.'
    );
  });

  it('warns the payer on /pay in their own terms', () => {
    render(form({ showFeeGuidance: false }));
    expect(screen.getByRole('note')).toHaveTextContent(
      'USDT can be harder to get from exchanges than USDC. Unless you already hold USDT, USDC is the easier choice.'
    );
  });

  it('says nothing for USDC', () => {
    render(form({ tokenSymbol: 'USDC' }));
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('says nothing where the token can be paid for with USDC, to seller or payer', () => {
    // A note here read as a problem with choosing USDT, whatever it said.
    const { unmount } = render(form({ payableWith: 'USDC' }));
    expect(screen.queryByRole('note')).toBeNull();
    unmount();

    render(form({ payableWith: 'USDC', showFeeGuidance: false }));
    expect(screen.queryByRole('note')).toBeNull();
  });
});
