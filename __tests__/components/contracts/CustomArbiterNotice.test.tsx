import { render, screen } from '@testing-library/react';
import CustomArbiterNotice from '../../../components/contracts/CustomArbiterNotice';

const VALID_ARBITER = '0x4f11cEf6E89CB7F4050E89BA88A5f2Fe1e53482d';

describe('CustomArbiterNotice', () => {
  it('renders the warning banner when arbiterAddress is provided', () => {
    render(<CustomArbiterNotice arbiterAddress={VALID_ARBITER} />);

    // Heading / title
    expect(screen.getByText('Custom dispute resolver')).toBeInTheDocument();

    // Body copy
    expect(
      screen.getByText(/non-standard arbiter chosen by the seller/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Verify you trust this arbiter before paying\./i)
    ).toBeInTheDocument();

    // Address displayed (truncated form: first 6 + last 4 chars via formatWalletAddress)
    const addressEl = screen.getByTestId('custom-arbiter-address');
    expect(addressEl).toBeInTheDocument();
    // Truncated display should start with 0x and contain an ellipsis separator
    expect(addressEl.textContent).toMatch(/^0x[0-9a-fA-F]{4}/);
    expect(addressEl.textContent).toContain('...');
    expect(addressEl.textContent).toContain(VALID_ARBITER.slice(-4));
    // Full address is preserved in the title attribute for inspection
    expect(addressEl).toHaveAttribute('title', VALID_ARBITER);

    // Container should use the shared yellow-notice styling
    const container = screen.getByTestId('custom-arbiter-notice');
    expect(container.className).toContain('bg-yellow-50');
    expect(container.className).toContain('border-yellow-200');
  });

  it('does NOT render when arbiterAddress is undefined', () => {
    const { container } = render(<CustomArbiterNotice arbiterAddress={undefined} />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId('custom-arbiter-notice')).not.toBeInTheDocument();
    expect(screen.queryByText('Custom dispute resolver')).not.toBeInTheDocument();
  });

  it('does NOT render when arbiterAddress is null', () => {
    const { container } = render(<CustomArbiterNotice arbiterAddress={null} />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId('custom-arbiter-notice')).not.toBeInTheDocument();
  });

  it('does NOT render when arbiterAddress is an empty string', () => {
    const { container } = render(<CustomArbiterNotice arbiterAddress="" />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId('custom-arbiter-notice')).not.toBeInTheDocument();
  });

  it('does NOT render when arbiterAddress is whitespace only', () => {
    const { container } = render(<CustomArbiterNotice arbiterAddress="   " />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId('custom-arbiter-notice')).not.toBeInTheDocument();
  });
});
