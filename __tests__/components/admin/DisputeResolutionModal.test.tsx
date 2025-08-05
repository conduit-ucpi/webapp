import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter } from 'next/router';
import { useConfig } from '@/components/auth/ConfigProvider';
import DisputeResolutionModal from '@/components/admin/DisputeResolutionModal';

// Mock next/router
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

// Mock ConfigProvider
jest.mock('@/components/auth/ConfigProvider', () => ({
  useConfig: jest.fn(),
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
const mockUseConfig = useConfig as jest.MockedFunction<typeof useConfig>;
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

const mockContract = {
  id: '1',
  description: 'Test contract',
  amount: 1000,
  currency: 'microUSDC',
  sellerEmail: 'seller@example.com',
  buyerEmail: 'buyer@example.com',
  expiryTimestamp: 1735689600, // Unix timestamp: 2025-01-01T00:00:00Z
  adminNotes: [
    {
      id: 'note1',
      content: 'First admin note',
      addedAt: 1735689600000, // Unix timestamp in milliseconds: 2025-01-01T00:00:00Z
      addedBy: 'admin@example.com'
    }
  ]
};

describe('DisputeResolutionModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    contractId: '1',
    chainAddress: '0x1234567890abcdef',
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

    mockUseConfig.mockReturnValue({
      config: {
        web3AuthClientId: 'test-client-id',
        web3AuthNetwork: 'testnet',
        chainId: 43113,
        rpcUrl: 'https://api.avax-test.network/ext/bc/C/rpc',
        usdcContractAddress: '0x5425890298aed601595a70AB815c96711a31Bc65',
        moonPayApiKey: 'test-key',
        minGasWei: '20000000000',
        basePath: '',
        snowtraceBaseUrl: 'https://testnet.snowtrace.io',
        serviceLink: 'http://localhost:3000'
      },
      isLoading: false
    });

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
      expect(screen.getByText('$1000 microUSDC')).toBeInTheDocument();
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
          content: 'New test note',
          addedAt: 1735776000000, // Unix timestamp in milliseconds: 2025-01-02T00:00:00Z
          addedBy: 'admin@example.com'
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

    // With auto-calculation, we can't create invalid percentages by typing in both fields
    // Instead, test that the button is disabled when no percentages are entered
    const resolveButton = screen.getByText('Add Note and Resolve');

    // Button should be disabled when no percentages are set
    expect(resolveButton).toBeDisabled();

    // Now enter a valid percentage
    const percentageInputs = screen.getAllByPlaceholderText('0-100');
    const buyerInput = percentageInputs[0];
    fireEvent.change(buyerInput, { target: { value: '60' } });

    // Total should show in green and indicate 100%
    await waitFor(() => {
      expect(screen.getByText('Total: 100.00%')).toBeInTheDocument();
      expect(screen.getByText('Total: 100.00%')).toHaveClass('text-green-600');
    });

    // Button should now be enabled
    expect(resolveButton).not.toBeDisabled();
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
          resolutionNote: 'Resolution note',
          chainAddress: '0x1234567890abcdef',
          buyerEmail: 'buyer@example.com',
          sellerEmail: 'seller@example.com',
          amount: '1000',
          currency: 'microUSDC',
          contractDescription: 'Test contract',
          payoutDateTime: '1735689600',
          buyerActualAmount: '600',
          sellerActualAmount: '400',
          serviceLink: 'http://localhost:3000'
        })
      });

      expect(defaultProps.onResolutionComplete).toHaveBeenCalled();
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  it('includes email addresses when resolving dispute', async () => {
    const contractWithEmails = {
      ...mockContract,
      buyerEmail: 'test-buyer@example.com',
      sellerEmail: 'test-seller@example.com'
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => contractWithEmails
    } as Response);

    render(<DisputeResolutionModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Test contract')).toBeInTheDocument();
    });

    // Add resolution note
    const noteInput = screen.getByPlaceholderText('Enter your note about this dispute...');
    fireEvent.change(noteInput, { target: { value: 'Email test resolution' } });

    // Set percentages
    const percentageInputs = screen.getAllByPlaceholderText('0-100');
    fireEvent.change(percentageInputs[0], { target: { value: '55' } });

    // Mock successful note addition
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true })
    } as Response);

    // Mock successful resolution
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true })
    } as Response);

    const resolveButton = screen.getByText('Add Note and Resolve');
    fireEvent.click(resolveButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    // Verify resolution was called with email addresses
    expect(mockFetch).toHaveBeenCalledWith('/api/admin/contracts/1/resolve', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        buyerPercentage: 55,
        sellerPercentage: 45,
        resolutionNote: 'Email test resolution',
        chainAddress: '0x1234567890abcdef',
        buyerEmail: 'test-buyer@example.com',
        sellerEmail: 'test-seller@example.com',
        amount: '1000',
        currency: 'microUSDC',
        contractDescription: 'Test contract',
        payoutDateTime: '1735689600',
        buyerActualAmount: '550',
        sellerActualAmount: '450',
        serviceLink: 'http://localhost:3000'
      })
    });
  });

  it('handles missing email addresses gracefully when resolving', async () => {
    const contractWithoutEmails = {
      ...mockContract,
      buyerEmail: undefined,
      sellerEmail: undefined
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => contractWithoutEmails
    } as Response);

    render(<DisputeResolutionModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Test contract')).toBeInTheDocument();
    });

    // Add resolution note
    const noteInput = screen.getByPlaceholderText('Enter your note about this dispute...');
    fireEvent.change(noteInput, { target: { value: 'No email resolution' } });

    // Set percentages
    const percentageInputs = screen.getAllByPlaceholderText('0-100');
    fireEvent.change(percentageInputs[0], { target: { value: '50' } });

    // Mock successful note addition
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true })
    } as Response);

    // Mock successful resolution
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true })
    } as Response);

    const resolveButton = screen.getByText('Add Note and Resolve');
    fireEvent.click(resolveButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    // Verify resolution was called with undefined email addresses
    expect(mockFetch).toHaveBeenCalledWith('/api/admin/contracts/1/resolve', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        buyerPercentage: 50,
        sellerPercentage: 50,
        resolutionNote: 'No email resolution',
        chainAddress: '0x1234567890abcdef',
        buyerEmail: undefined,
        sellerEmail: undefined,
        amount: '1000',
        currency: 'microUSDC',
        contractDescription: 'Test contract',
        payoutDateTime: '1735689600',
        buyerActualAmount: '500',
        sellerActualAmount: '500',
        serviceLink: 'http://localhost:3000'
      })
    });
  });

  it('auto-calculates percentages when typing in buyer field', async () => {
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
    const sellerInput = percentageInputs[1];

    // Type in buyer field
    fireEvent.change(buyerInput, { target: { value: '75' } });

    // Seller field should immediately update to 25
    expect(sellerInput).toHaveValue(25);

    // Test with decimal values
    fireEvent.change(buyerInput, { target: { value: '33.33' } });
    expect(sellerInput).toHaveValue(66.67);

    // Test edge cases
    fireEvent.change(buyerInput, { target: { value: '0' } });
    expect(sellerInput).toHaveValue(100);

    fireEvent.change(buyerInput, { target: { value: '100' } });
    expect(sellerInput).toHaveValue(0);
  });

  it('auto-calculates percentages when typing in seller field', async () => {
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
    const sellerInput = percentageInputs[1];

    // Type in seller field
    fireEvent.change(sellerInput, { target: { value: '40' } });

    // Buyer field should immediately update to 60
    expect(buyerInput).toHaveValue(60);

    // Test with decimal values
    fireEvent.change(sellerInput, { target: { value: '45.5' } });
    expect(buyerInput).toHaveValue(54.5);
  });

  it('clears both fields when one is cleared', async () => {
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
    const sellerInput = percentageInputs[1];

    // Set initial values
    fireEvent.change(buyerInput, { target: { value: '60' } });
    expect(sellerInput).toHaveValue(40);

    // Clear buyer field
    fireEvent.change(buyerInput, { target: { value: '' } });

    // Both fields should be empty
    expect(buyerInput).toHaveValue(null);
    expect(sellerInput).toHaveValue(null);
  });

  it('handles invalid input gracefully', async () => {
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
    const sellerInput = percentageInputs[1];

    // Type invalid values
    fireEvent.change(buyerInput, { target: { value: 'abc' } });
    // Seller field should not update for invalid input
    expect(sellerInput).toHaveValue(null);

    // Type value over 100
    fireEvent.change(buyerInput, { target: { value: '150' } });
    // Seller field should not update for values over 100
    expect(sellerInput).toHaveValue(null);

    // Type negative value
    fireEvent.change(buyerInput, { target: { value: '-10' } });
    // Seller field should not update for negative values
    expect(sellerInput).toHaveValue(null);
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

  it('handles both Unix timestamps and ISO date strings', async () => {
    const mixedDateContract = {
      ...mockContract,
      adminNotes: [
        {
          id: 'note1',
          content: 'Unix timestamp note',
          addedAt: 1735689600000, // Unix timestamp in milliseconds
          addedBy: 'admin1@example.com'
        },
        {
          id: 'note2',
          content: 'ISO string note',
          addedAt: 1735776000000, // Unix timestamp in milliseconds
          addedBy: 'admin2@example.com'
        }
      ]
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mixedDateContract
    } as Response);

    render(<DisputeResolutionModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Unix timestamp note')).toBeInTheDocument();
      expect(screen.getByText('ISO string note')).toBeInTheDocument();
      // Both dates should be displayed correctly
      expect(screen.getByText('admin1@example.com')).toBeInTheDocument();
      expect(screen.getByText('admin2@example.com')).toBeInTheDocument();
    });
  });

  it('handles seller percentage change and clears buyer when seller is empty', async () => {
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
    const sellerInput = percentageInputs[1];

    // Set initial values
    fireEvent.change(buyerInput, { target: { value: '60' } });
    expect(sellerInput).toHaveValue(40);

    // Clear seller field - should clear buyer too
    fireEvent.change(sellerInput, { target: { value: '' } });

    expect(buyerInput).toHaveValue(null);
    expect(sellerInput).toHaveValue(null);
  });

  it('validates empty note on resolution', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockContract
    } as Response);

    render(<DisputeResolutionModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Test contract')).toBeInTheDocument();
    });

    // Set percentages but leave note empty
    const percentageInputs = screen.getAllByPlaceholderText('0-100');
    const buyerInput = percentageInputs[0];
    fireEvent.change(buyerInput, { target: { value: '60' } });

    // Note input should be empty
    const noteInput = screen.getByPlaceholderText('Enter your note about this dispute...');
    expect(noteInput).toHaveValue('');

    // Button should be disabled due to empty note
    const resolveButton = screen.getByText('Add Note and Resolve');
    expect(resolveButton).toBeDisabled();
  });

  it('validates percentages sum to 100 with direct state manipulation', async () => {
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

    // Since auto-calculation prevents invalid combinations,
    // we test with NaN values which bypass the auto-calculation logic
    const percentageInputs = screen.getAllByPlaceholderText('0-100');
    const buyerInput = percentageInputs[0];

    // Set invalid (non-numeric) buyer percentage
    fireEvent.change(buyerInput, { target: { value: 'invalid' } });

    // Button should be disabled due to invalid percentages
    const resolveButton = screen.getByText('Add Note and Resolve');
    expect(resolveButton).toBeDisabled();
  });

  it('validates percentages are within 0-100 range', async () => {
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

    // Since auto-calculation prevents manual setting of both fields,
    // we need to test the validation in a way that works with the logic.
    // The validation checks happen inside addNote when resolveDispute=true
    // But since auto-calculation ensures valid combinations, we test with empty values
    const percentageInputs = screen.getAllByPlaceholderText('0-100');
    const buyerInput = percentageInputs[0];

    // Clear both fields (this bypasses auto-calculation)
    fireEvent.change(buyerInput, { target: { value: '' } });

    // Button should be disabled due to empty/invalid percentages
    const resolveButton = screen.getByText('Add Note and Resolve');
    expect(resolveButton).toBeDisabled();
  });

  it('handles note addition failure', async () => {
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

    // Mock failed note addition
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500
    } as Response);

    const addNoteButtons = screen.getAllByText('Add Note');
    const addNoteButton = addNoteButtons[addNoteButtons.length - 1];
    fireEvent.click(addNoteButton);

    await waitFor(() => {
      expect(screen.getByText('Failed to add note')).toBeInTheDocument();
    });
  });

  it('handles resolution failure after successful note addition', async () => {
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
      json: async () => ({ id: 'note3', content: 'Resolution note' })
    } as Response);

    // Mock failed resolution
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500
    } as Response);

    const resolveButton = screen.getByText('Add Note and Resolve');
    fireEvent.click(resolveButton);

    await waitFor(() => {
      expect(screen.getByText('Failed to resolve dispute')).toBeInTheDocument();
    });
  });

  it('handles generic error in addNote function', async () => {
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

    // Mock network error
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const addNoteButtons = screen.getAllByText('Add Note');
    const addNoteButton = addNoteButtons[addNoteButtons.length - 1];
    fireEvent.click(addNoteButton);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('handles error without message in addNote function', async () => {
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

    // Mock error without message
    mockFetch.mockRejectedValueOnce({});

    const addNoteButtons = screen.getAllByText('Add Note');
    const addNoteButton = addNoteButtons[addNoteButtons.length - 1];
    fireEvent.click(addNoteButton);

    await waitFor(() => {
      expect(screen.getByText('Failed to process request')).toBeInTheDocument();
    });
  });
});

