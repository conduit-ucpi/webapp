/**
 * The summary as the person paying sees it: the money first, and figures and dates as a person
 * reads them. The seller's own review screen (the default) is unchanged.
 */
import { render, screen } from '@testing-library/react';
import ReviewRequest from '@/components/contracts/ReviewRequest';
import CreateProgressSteps from '@/components/contracts/CreateProgressSteps';

jest.mock('@/hooks/useExchangeRate', () => ({ useExchangeRate: () => ({ rate: 1 }) }));

const RELEASE = 1795954140; // 2026-11-29T12:09:00Z
const review = (extra: Record<string, unknown> = {}) => (
  <ReviewRequest
    amount="100"
    tokenSymbol="USDC"
    networkLabel="Base Mainnet"
    description="Logo design"
    payoutTimestamp={RELEASE}
    isInstantPayment={false}
    extraRows={[
      { label: 'They receive', value: '99.000000 USDC' },
      { label: 'Platform fee', value: '1.000000 USDC' },
      { label: 'Tiny', value: '0.001234 USDC' },
      { label: 'Paying', value: 'seller@example.com' },
    ]}
    nextBody={null}
    {...extra}
  />
);

describe('ReviewRequest for the person paying', () => {
  it('leads with the money, with the token and network beneath it', () => {
    render(review({ moneyFirst: true }));
    expect(screen.getByText('$100.00')).toBeInTheDocument();
    expect(screen.getByText('100.00 USDC · Base Mainnet')).toBeInTheDocument();
  });

  it('drops the zeros nobody reads, never below two decimals and never a digit that counts', () => {
    render(review({ moneyFirst: true }));
    expect(screen.getByText('99.00 USDC')).toBeInTheDocument();
    expect(screen.getByText('1.00 USDC')).toBeInTheDocument();
    expect(screen.getByText('0.001234 USDC')).toBeInTheDocument();
    expect(screen.getByText('seller@example.com')).toBeInTheDocument();
  });

  it('gives the release as a date and time, not a timestamp', () => {
    render(review({ moneyFirst: true }));
    const shown = new Date(RELEASE * 1000).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    expect(screen.getByText(shown)).toBeInTheDocument();
    expect(screen.queryByText(/T\d\d:\d\d:\d\d/)).toBeNull();
  });

  it("leaves the seller's own review as it was", () => {
    render(review());
    expect(screen.getByText('99.000000 USDC')).toBeInTheDocument();
    expect(screen.getByText(/T\d\d:\d\d:\d\d/)).toBeInTheDocument();
  });
});

describe('the step indicator', () => {
  it('can keep its names and drop the line under each', () => {
    const { rerender } = render(<CreateProgressSteps current={1} />);
    const withDetail = document.querySelectorAll('li p').length;
    rerender(<CreateProgressSteps current={1} titlesOnly />);
    expect(document.querySelectorAll('li p')).toHaveLength(withDetail / 2);
    expect(document.querySelectorAll('li')).toHaveLength(3);
  });
});
