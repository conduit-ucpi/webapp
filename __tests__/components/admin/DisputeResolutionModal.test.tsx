import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter } from 'next/router';
import DisputeResolutionModal from '@/components/admin/DisputeResolutionModal';

// Mock next/router
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

// Mock UI components
jest.mock('@/components/ui/Modal', () => {
  return function MockModal({ isOpen, children, title }: any) {
    if (!isOpen) return null;
    return (
      <div data-testid="modal">
        <h2>{title}</h2>
        {children}
      </div>
    );
  };
});

jest.mock('@/components/ui/Button', () => {
  return function MockButton({ children, disabled, onClick, className, variant }: any) {
    return (
      <button 
        disabled={disabled} 
        onClick={onClick} 
        className={className}
        data-variant={variant}
      >
        {children}
      </button>
    );
  };
});

jest.mock('@/components/ui/Input', () => {
  return function MockInput(props: any) {
    return <input {...props} />;
  };
});

jest.mock('@/components/ui/LoadingSpinner', () => {
  return function MockLoadingSpinner({ size }: { size?: string }) {
    return <div data-testid="loading-spinner" data-size={size}>Loading...</div>;
  };
});

// Mock global fetch
global.fetch = jest.fn();

const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

const mockContract = {
  id: '1',
  description: 'Test contract',
  amount: 1000,
  currency: 'USDC',
  sellerEmail: 'seller@example.com',
  buyerEmail: 'buyer@example.com',
  adminNotes: [
    {
      id: 'note1',
      note: 'First admin note',
      createdAt: '2025-01-01T00:00:00Z',
      adminEmail: 'admin@example.com'
    }
  ]
};

describe('DisputeResolutionModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    contractId: '1',
    onResolutionComplete: jest.fn()
  };

  beforeEach(() => {
    mockUseRouter.mockReturnValue({
      basePath: '',
      pathname: '/admin',
      query: {},
      push: jest.fn(),
      replace: jest.fn(),
      back: jest.fn(),
      prefetch: jest.fn(),
      beforePopState: jest.fn(),
      events: {
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn(),
      },
      isFallback: false,
      isLocaleDomain: false,
      isReady: true,
      defaultLocale: 'en',
      domainLocales: [],
      isPreview: false,
      asPath: '/admin',
      route: '/admin',
      reload: jest.fn(),
    } as any);

    jest.clearAllMocks();
  });

  it('fetches contract with notes when opened', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockContract
    } as Response);

    render(<DisputeResolutionModal {...defaultProps} />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/admin/contracts/1/notes', {
        method: 'GET',
        credentials: 'include'
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Test contract')).toBeInTheDocument();
      expect(screen.getByText('$1000 USDC')).toBeInTheDocument();
    });
  });

  it('displays existing admin notes', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockContract
    } as Response);

    render(<DisputeResolutionModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('First admin note')).toBeInTheDocument();
      expect(screen.getByText('admin@example.com')).toBeInTheDocument();
    });
  });

  it('adds a new note with correct JSON format', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockContract
    } as Response);

    render(<DisputeResolutionModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Test contract')).toBeInTheDocument();
    });

    const noteInput = screen.getByPlaceholderText('Enter your note about this dispute...');
    fireEvent.change(noteInput, { target: { value: 'New test note' } });

    // Mock successful note addition
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'note2', note: 'New test note' })
    } as Response);

    // Mock refresh after adding note
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ...mockContract,
        adminNotes: [...mockContract.adminNotes, {
          id: 'note2',
          note: 'New test note',
          createdAt: '2025-01-02T00:00:00Z',
          adminEmail: 'admin@example.com'
        }]
      })
    } as Response);

    const addNoteButtons = screen.getAllByText('Add Note');
    const addNoteButton = addNoteButtons[addNoteButtons.length - 1]; // Get the button, not the heading
    fireEvent.click(addNoteButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/admin/contracts/1/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ note: 'New test note' })
      });
    });
  });

  it('validates percentages before resolution', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockContract
    } as Response);

    render(<DisputeResolutionModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Test contract')).toBeInTheDocument();
    });

    const noteInput = screen.getByPlaceholderText('Enter your note about this dispute...');
    fireEvent.change(noteInput, { target: { value: 'Resolution note' } });

    const percentageInputs = screen.getAllByPlaceholderText('0-100');
    const buyerInput = percentageInputs[0];
    const sellerInput = percentageInputs[1];
    
    fireEvent.change(buyerInput, { target: { value: '60' } });
    fireEvent.change(sellerInput, { target: { value: '50' } });

    // Mock the failed note addition that triggers validation
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'note2', note: 'Resolution note' })
    } as Response);

    const resolveButton = screen.getByText('Add Note and Resolve');
    fireEvent.click(resolveButton);

    await waitFor(() => {
      expect(screen.getByText('Buyer and seller percentages must add up to 100%')).toBeInTheDocument();
    });
  });

  it('resolves dispute with note and correct percentages', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockContract
    } as Response);

    render(<DisputeResolutionModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Test contract')).toBeInTheDocument();
    });

    const noteInput = screen.getByPlaceholderText('Enter your note about this dispute...');
    fireEvent.change(noteInput, { target: { value: 'Resolution note' } });

    const percentageInputs = screen.getAllByPlaceholderText('0-100');
    const buyerInput = percentageInputs[0];
    fireEvent.change(buyerInput, { target: { value: '60' } });

    // Mock successful note addition
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'note3', note: 'Resolution note' })
    } as Response);

    // Mock successful resolution
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true })
    } as Response);

    const resolveButton = screen.getByText('Add Note and Resolve');
    fireEvent.click(resolveButton);

    await waitFor(() => {
      // First call adds the note with correct JSON format
      expect(mockFetch).toHaveBeenCalledWith('/api/admin/contracts/1/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ note: 'Resolution note' })
      });

      // Second call resolves the dispute
      expect(mockFetch).toHaveBeenCalledWith('/api/admin/contracts/1/resolve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          buyerPercentage: 60,
          sellerPercentage: 40,
          resolutionNote: 'Resolution note'
        })
      });

      expect(defaultProps.onResolutionComplete).toHaveBeenCalled();
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  it('auto-calculates percentages', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockContract
    } as Response);

    render(<DisputeResolutionModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Test contract')).toBeInTheDocument();
    });

    const percentageInputs = screen.getAllByPlaceholderText('0-100');
    const buyerInput = percentageInputs[0];
    
    fireEvent.change(buyerInput, { target: { value: '75' } });

    // Re-query for inputs after state update
    await waitFor(() => {
      const updatedInputs = screen.getAllByPlaceholderText('0-100');
      const updatedSellerInput = updatedInputs[1];
      expect(updatedSellerInput).toHaveValue('25');
    });
  });

  it('handles fetch errors gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    render(<DisputeResolutionModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });
  });

  it('disables buttons during submission', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockContract
    } as Response);

    render(<DisputeResolutionModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Test contract')).toBeInTheDocument();
    });

    const noteInput = screen.getByPlaceholderText('Enter your note about this dispute...');
    fireEvent.change(noteInput, { target: { value: 'Test note' } });

    // Mock a slow response
    mockFetch.mockImplementationOnce(() => new Promise(resolve => setTimeout(() => resolve({
      ok: true,
      json: async () => ({ id: 'note3', note: 'Test note' })
    } as Response), 100)));

    const addNoteButtons = screen.getAllByText('Add Note');
    const addNoteButton = addNoteButtons[addNoteButtons.length - 1];
    fireEvent.click(addNoteButton);

    // Buttons should be disabled during submission
    expect(screen.getByText('Cancel')).toBeDisabled();
    // There are multiple loading spinners, one in each button
    const spinners = screen.getAllByTestId('loading-spinner');
    expect(spinners.length).toBeGreaterThan(0);
  });

  it('clears form when modal is closed', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockContract
    } as Response);

    render(<DisputeResolutionModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Test contract')).toBeInTheDocument();
    });

    const noteInput = screen.getByPlaceholderText('Enter your note about this dispute...');
    fireEvent.change(noteInput, { target: { value: 'Test note' } });

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('does not fetch when modal is closed', () => {
    render(<DisputeResolutionModal {...defaultProps} isOpen={false} />);

    expect(mockFetch).not.toHaveBeenCalled();
    expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
  });
});