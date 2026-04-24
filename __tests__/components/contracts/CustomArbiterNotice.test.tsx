import { render, screen, act } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import CustomArbiterNotice from '../../../components/contracts/CustomArbiterNotice';

const VALID_ARBITER = '0x4f11cEf6E89CB7F4050E89BA88A5f2Fe1e53482d';

describe('CustomArbiterNotice', () => {
  it('renders the warning banner when arbiterAddress is provided', () => {
    render(<CustomArbiterNotice arbiterAddress={VALID_ARBITER} />);

    // Heading / title
    expect(screen.getByText('Custom dispute resolver')).toBeInTheDocument();

    // Body copy — new wording references "application admin"
    expect(
      screen.getByText(/non-standard arbiter chosen by the seller/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/not the application admin/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Verify you trust this arbiter before paying\./i)
    ).toBeInTheDocument();

    // Address displayed in FULL (not truncated) so the buyer can verify it.
    const addressEl = screen.getByTestId('custom-arbiter-address');
    expect(addressEl).toBeInTheDocument();
    expect(addressEl.textContent).toBe(VALID_ARBITER);
    // Uses font-mono + break-all so long addresses wrap on small screens
    expect(addressEl.className).toContain('font-mono');
    expect(addressEl.className).toContain('break-all');
    // Full address is preserved in the title attribute for hover tooltip
    expect(addressEl).toHaveAttribute('title', VALID_ARBITER);

    // Container should use the shared yellow-notice styling
    const container = screen.getByTestId('custom-arbiter-notice');
    expect(container.className).toContain('bg-yellow-50');
    expect(container.className).toContain('border-yellow-200');
  });

  it('does NOT render the old "Conduit default" wording', () => {
    render(<CustomArbiterNotice arbiterAddress={VALID_ARBITER} />);
    expect(screen.queryByText(/Conduit default/i)).not.toBeInTheDocument();
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

  describe('copy button', () => {
    it('renders the copy button with proper accessibility attributes', () => {
      render(<CustomArbiterNotice arbiterAddress={VALID_ARBITER} />);
      const copyButton = screen.getByTestId('custom-arbiter-copy-button');
      expect(copyButton).toBeInTheDocument();
      expect(copyButton).toHaveAttribute('type', 'button');
      expect(copyButton).toHaveAttribute('aria-label', 'Copy arbiter address');
      expect(copyButton.textContent).toBe('Copy');
    });

    it('calls navigator.clipboard.writeText with the full arbiter address when clicked', async () => {
      const mockWriteText = jest.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: { writeText: mockWriteText },
      });

      render(<CustomArbiterNotice arbiterAddress={VALID_ARBITER} />);
      const copyButton = screen.getByTestId('custom-arbiter-copy-button');

      await act(async () => {
        fireEvent.click(copyButton);
      });

      expect(mockWriteText).toHaveBeenCalledTimes(1);
      expect(mockWriteText).toHaveBeenCalledWith(VALID_ARBITER);
    });

    it('shows "Copied!" feedback after the button is clicked', async () => {
      const mockWriteText = jest.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: { writeText: mockWriteText },
      });

      render(<CustomArbiterNotice arbiterAddress={VALID_ARBITER} />);
      const copyButton = screen.getByTestId('custom-arbiter-copy-button');

      // Before click: label is "Copy"
      expect(copyButton.textContent).toBe('Copy');

      await act(async () => {
        fireEvent.click(copyButton);
      });

      // After click: label flips to "Copied!"
      expect(copyButton.textContent).toBe('Copied!');
    });

    it('reverts the "Copied!" feedback back to "Copy" after the timeout', async () => {
      jest.useFakeTimers();
      const mockWriteText = jest.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: { writeText: mockWriteText },
      });

      try {
        render(<CustomArbiterNotice arbiterAddress={VALID_ARBITER} />);
        const copyButton = screen.getByTestId('custom-arbiter-copy-button');

        // Flush the click + the awaited clipboard promise so setIsCopied(true) runs.
        await act(async () => {
          fireEvent.click(copyButton);
        });
        expect(copyButton.textContent).toBe('Copied!');

        // Advance past the 1.5s revert timeout.
        act(() => {
          jest.advanceTimersByTime(1600);
        });

        expect(copyButton.textContent).toBe('Copy');
      } finally {
        jest.useRealTimers();
      }
    });

    it('handles clipboard write failure gracefully without crashing', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const mockWriteText = jest.fn().mockRejectedValue(new Error('Clipboard failed'));
      Object.assign(navigator, {
        clipboard: { writeText: mockWriteText },
      });

      render(<CustomArbiterNotice arbiterAddress={VALID_ARBITER} />);
      const copyButton = screen.getByTestId('custom-arbiter-copy-button');

      await act(async () => {
        fireEvent.click(copyButton);
      });

      expect(mockWriteText).toHaveBeenCalledWith(VALID_ARBITER);
      // Label should remain "Copy" because we never set the copied state
      expect(copyButton.textContent).toBe('Copy');
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to copy arbiter address:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });
});
