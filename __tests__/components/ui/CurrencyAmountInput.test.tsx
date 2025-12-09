import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CurrencyAmountInput from '@/components/ui/CurrencyAmountInput';
import * as useExchangeRateModule from '@/hooks/useExchangeRate';
import * as currencyDetectionModule from '@/utils/currencyDetection';

// Mock the hooks and utilities
jest.mock('@/hooks/useExchangeRate');
jest.mock('@/utils/currencyDetection');

const mockUseExchangeRate = useExchangeRateModule.useExchangeRate as jest.MockedFunction<typeof useExchangeRateModule.useExchangeRate>;
const mockDetectUserCurrency = currencyDetectionModule.detectUserCurrency as jest.MockedFunction<typeof currencyDetectionModule.detectUserCurrency>;

describe('CurrencyAmountInput', () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations
    mockDetectUserCurrency.mockReturnValue('EUR');
    mockUseExchangeRate.mockReturnValue({
      rate: 0.85,
      isLoading: false,
      error: null,
      lastUpdated: new Date(),
      source: 'Coinbase',
      refresh: jest.fn()
    });
  });

  it('should render both currency inputs', () => {
    render(
      <CurrencyAmountInput
        value="100"
        onChange={mockOnChange}
        tokenSymbol="USDC"
      />
    );

    // Should have local currency input
    const localInputs = screen.getAllByRole('spinbutton');
    expect(localInputs).toHaveLength(2);

    // Should show conversion rate
    expect(screen.getByText(/1 EUR = 0.85/)).toBeInTheDocument();
  });

  it.skip('should auto-detect user currency', async () => {
    mockDetectUserCurrency.mockReturnValue('GBP');

    render(
      <CurrencyAmountInput
        value="100"
        onChange={mockOnChange}
        tokenSymbol="USDC"
      />
    );

    await waitFor(() => {
      expect(mockDetectUserCurrency).toHaveBeenCalled();
    });

    // Should show GBP in the dropdown
    const select = screen.getByRole('combobox');
    expect(select).toHaveValue('GBP');
  });

  it.skip('should convert local currency to USDC when typing in local field', async () => {
    render(
      <CurrencyAmountInput
        value=""
        onChange={mockOnChange}
        tokenSymbol="USDC"
      />
    );

    const inputs = screen.getAllByRole('spinbutton');
    const localInput = inputs[0];

    // Type 100 EUR
    fireEvent.change(localInput, { target: { value: '100' } });

    await waitFor(() => {
      // 100 EUR * 0.85 = 85 USDC
      expect(mockOnChange).toHaveBeenCalledWith('85.0000');
    });
  });

  it.skip('should convert USDC to local currency when typing in USDC field', async () => {
    render(
      <CurrencyAmountInput
        value=""
        onChange={mockOnChange}
        tokenSymbol="USDC"
      />
    );

    const inputs = screen.getAllByRole('spinbutton');
    const usdcInput = inputs[1];

    // Type 85 USDC
    fireEvent.change(usdcInput, { target: { value: '85' } });

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith('85');
    });

    // Local field should show converted amount (85 / 0.85 = 100 EUR)
    const localInput = inputs[0];
    await waitFor(() => {
      expect(localInput).toHaveValue(100);
    });
  });

  it.skip('should update local amount when currency is changed', async () => {
    // Start with EUR rate
    let currentRate = 0.85;
    mockUseExchangeRate.mockImplementation((fromCurrency) => ({
      rate: fromCurrency === 'GBP' ? 0.73 : 0.85,
      isLoading: false,
      error: null,
      lastUpdated: new Date(),
      source: 'Coinbase',
      refresh: jest.fn()
    }));

    const { rerender } = render(
      <CurrencyAmountInput
        value="100"
        onChange={mockOnChange}
        tokenSymbol="USDC"
      />
    );

    // Wait for initial render
    await waitFor(() => {
      const inputs = screen.getAllByRole('spinbutton');
      expect(inputs).toHaveLength(2);
    });

    const select = screen.getByRole('combobox');

    // Change from EUR to GBP - this triggers a re-render with new rate
    fireEvent.change(select, { target: { value: 'GBP' } });

    // The component should trigger useExchangeRate with 'GBP'
    // and recalculate the local amount based on the new rate (0.73)
    await waitFor(() => {
      const inputs = screen.getAllByRole('spinbutton');
      const localInput = inputs[0] as HTMLInputElement;
      // 100 USDC / 0.73 = ~137.0 GBP
      const value = parseFloat(localInput.value);
      expect(value).toBeGreaterThan(130);
      expect(value).toBeLessThan(140);
    }, { timeout: 3000 });
  });

  it('should display error message', () => {
    render(
      <CurrencyAmountInput
        value="100"
        onChange={mockOnChange}
        tokenSymbol="USDC"
        error="Amount must be positive"
      />
    );

    expect(screen.getByText('Amount must be positive')).toBeInTheDocument();
  });

  it('should disable amount inputs when disabled prop is true but keep currency selector enabled', () => {
    render(
      <CurrencyAmountInput
        value="100"
        onChange={mockOnChange}
        tokenSymbol="USDC"
        disabled={true}
      />
    );

    const inputs = screen.getAllByRole('spinbutton');
    inputs.forEach(input => {
      expect(input).toBeDisabled();
    });

    // Currency selector should remain enabled so users can see different currency conversions
    const select = screen.getByRole('combobox');
    expect(select).not.toBeDisabled();
  });

  it('should show loading state for exchange rate', () => {
    mockUseExchangeRate.mockReturnValue({
      rate: 0,
      isLoading: true,
      error: null,
      lastUpdated: undefined,
      source: '',
      refresh: jest.fn()
    });

    render(
      <CurrencyAmountInput
        value="100"
        onChange={mockOnChange}
        tokenSymbol="USDC"
      />
    );

    // Should disable local currency input while loading
    const inputs = screen.getAllByRole('spinbutton');
    const localInput = inputs[0];
    expect(localInput).toBeDisabled();
  });

  it('should show rate error warning', () => {
    mockUseExchangeRate.mockReturnValue({
      rate: 1.0,
      isLoading: false,
      error: 'Failed to fetch rate',
      lastUpdated: undefined,
      source: '',
      refresh: jest.fn()
    });

    render(
      <CurrencyAmountInput
        value="100"
        onChange={mockOnChange}
        tokenSymbol="USDC"
      />
    );

    expect(screen.getByText(/Could not fetch exchange rate/)).toBeInTheDocument();
  });

  it.skip('should handle empty values', async () => {
    render(
      <CurrencyAmountInput
        value="100"
        onChange={mockOnChange}
        tokenSymbol="USDC"
      />
    );

    await waitFor(() => {
      const inputs = screen.getAllByRole('spinbutton');
      expect(inputs).toHaveLength(2);
    });

    const inputs = screen.getAllByRole('spinbutton');
    const localInput = inputs[0];

    // Clear local input (start with a value, then clear it)
    fireEvent.change(localInput, { target: { value: '' } });

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith('');
    });
  });

  it('should show USDT when tokenSymbol is USDT', () => {
    render(
      <CurrencyAmountInput
        value="100"
        onChange={mockOnChange}
        tokenSymbol="USDT"
      />
    );

    expect(screen.getByText('USDT')).toBeInTheDocument();
  });

  it('should highlight active input field', async () => {
    render(
      <CurrencyAmountInput
        value=""
        onChange={mockOnChange}
        tokenSymbol="USDC"
      />
    );

    const inputs = screen.getAllByRole('spinbutton');
    const localInput = inputs[0];

    // Type in local input
    fireEvent.change(localInput, { target: { value: '100' } });

    await waitFor(() => {
      // Local input should have highlighted classes
      expect(localInput.className).toContain('ring-2');
      expect(localInput.className).toContain('ring-primary-200');
    });
  });

  it('should show help text when provided', () => {
    render(
      <CurrencyAmountInput
        value="100"
        onChange={mockOnChange}
        tokenSymbol="USDC"
        helpText="Enter the payment amount"
      />
    );

    expect(screen.getByText('Enter the payment amount')).toBeInTheDocument();
  });
});
