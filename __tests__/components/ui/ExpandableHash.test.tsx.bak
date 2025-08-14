import { render, screen, fireEvent, act } from '@testing-library/react';
import ExpandableHash from '@/components/ui/ExpandableHash';

// Mock ConfigProvider
jest.mock('@/components/auth/ConfigProvider', () => ({
  useConfig: jest.fn(),
}));

const mockUseConfig = require('@/components/auth/ConfigProvider').useConfig;

describe('ExpandableHash', () => {
  const mockHash = '0x1234567890abcdef1234567890abcdef12345678';
  
  beforeEach(() => {
    mockUseConfig.mockReturnValue({
      config: {
        snowtraceBaseUrl: 'https://testnet.snowtrace.io',
      },
    });
  });

  it('renders shortened hash by default', () => {
    render(<ExpandableHash hash={mockHash} />);
    expect(screen.getByTitle(`View on Snowtrace: ${mockHash}`)).toHaveTextContent('0x1234...5678');
  });

  it('expands hash when expand button is clicked', () => {
    render(<ExpandableHash hash={mockHash} />);
    const expandButton = screen.getByTitle('Click to expand full address');
    
    fireEvent.click(expandButton);
    
    expect(screen.getByTitle(`View on Snowtrace: ${mockHash}`)).toHaveTextContent(mockHash);
  });

  it('toggles between expanded and collapsed state', () => {
    render(<ExpandableHash hash={mockHash} />);
    const expandButton = screen.getByTitle('Click to expand full address');
    
    // Initial state - collapsed
    expect(screen.getByTitle(`View on Snowtrace: ${mockHash}`)).toHaveTextContent('0x1234...5678');
    
    // Click to expand
    fireEvent.click(expandButton);
    expect(screen.getByTitle(`View on Snowtrace: ${mockHash}`)).toHaveTextContent(mockHash);
    
    // Click to collapse
    const collapseButton = screen.getByTitle('Click to collapse');
    fireEvent.click(collapseButton);
    expect(screen.getByTitle(`View on Snowtrace: ${mockHash}`)).toHaveTextContent('0x1234...5678');
  });

  it('handles undefined hash gracefully', () => {
    render(<ExpandableHash hash={undefined as any} />);
    const link = screen.getByRole('link');
    expect(link).toHaveTextContent('');
  });

  it('handles null hash gracefully', () => {
    render(<ExpandableHash hash={null as any} />);
    const link = screen.getByRole('link');
    expect(link).toHaveTextContent('');
  });

  it('handles empty string hash', () => {
    render(<ExpandableHash hash="" />);
    const link = screen.getByRole('link');
    expect(link).toHaveTextContent('');
  });

  it('copies hash to clipboard when copy button is clicked', async () => {
    const mockWriteText = jest.fn();
    Object.assign(navigator, {
      clipboard: {
        writeText: mockWriteText,
      },
    });

    render(<ExpandableHash hash={mockHash} />);
    const copyButton = screen.getByTitle('Copy to clipboard');
    
    await act(async () => {
      fireEvent.click(copyButton);
    });
    
    expect(mockWriteText).toHaveBeenCalledWith(mockHash);
  });

  it('shows checkmark after successful copy', async () => {
    const mockWriteText = jest.fn();
    Object.assign(navigator, {
      clipboard: {
        writeText: mockWriteText,
      },
    });

    render(<ExpandableHash hash={mockHash} />);
    const copyButton = screen.getByTitle('Copy to clipboard');
    
    await act(async () => {
      fireEvent.click(copyButton);
    });
    
    // Check for checkmark SVG
    const svg = copyButton.querySelector('svg');
    expect(svg).toHaveClass('text-green-600');
  });

  it('hides copy button when showCopyButton is false', () => {
    render(<ExpandableHash hash={mockHash} showCopyButton={false} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(1); // Only expand/collapse button
    expect(screen.queryByTitle('Copy to clipboard')).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<ExpandableHash hash={mockHash} className="custom-class" />);
    const container = screen.getByRole('link').parentElement?.parentElement;
    expect(container).toHaveClass('custom-class');
  });

  it('prevents event propagation when copying', async () => {
    const mockWriteText = jest.fn();
    const mockStopPropagation = jest.fn();
    Object.assign(navigator, {
      clipboard: {
        writeText: mockWriteText,
      },
    });

    render(<ExpandableHash hash={mockHash} />);
    const copyButton = screen.getByTitle('Copy to clipboard');
    
    const event = new MouseEvent('click', { bubbles: true });
    Object.defineProperty(event, 'stopPropagation', { value: mockStopPropagation });
    
    await act(async () => {
      fireEvent(copyButton, event);
    });
    
    expect(mockStopPropagation).toHaveBeenCalled();
  });

  it('handles clipboard copy failure gracefully', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    const mockWriteText = jest.fn().mockRejectedValue(new Error('Clipboard failed'));
    Object.assign(navigator, {
      clipboard: {
        writeText: mockWriteText,
      },
    });

    render(<ExpandableHash hash={mockHash} />);
    const copyButton = screen.getByTitle('Copy to clipboard');
    
    await act(async () => {
      fireEvent.click(copyButton);
    });
    
    expect(mockWriteText).toHaveBeenCalledWith(mockHash);
    expect(consoleSpy).toHaveBeenCalledWith('Failed to copy:', expect.any(Error));
    
    consoleSpy.mockRestore();
  });

  it('creates correct Snowtrace link', () => {
    render(<ExpandableHash hash={mockHash} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', `https://testnet.snowtrace.io/address/${mockHash}`);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('handles missing snowtraceBaseUrl config', () => {
    mockUseConfig.mockReturnValue({
      config: {},
    });
    
    render(<ExpandableHash hash={mockHash} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '#');
  });
});