/**
 * Regression test to ensure ContractAcceptance always includes required tokenAddress field
 * This prevents the "missing tokenAddress" error when creating contracts via chainservice
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ContractAcceptance from '@/components/contracts/ContractAcceptance';
import { PendingContract } from '@/types';

// Mock fetch to capture API calls
const mockFetch = jest.fn();
global.fetch = mockFetch as jest.Mock;

// Mock authenticated fetch
const mockAuthenticatedFetch = jest.fn();

jest.mock('@/components/auth', () => ({
  useAuth: () => ({
    user: {
      walletAddress: '0xBuyerAddress',
      email: 'buyer@example.com'
    },
    authenticatedFetch: mockAuthenticatedFetch,
  }),
}));

jest.mock('@/components/auth/ConfigProvider', () => ({
  useConfig: () => ({
    config: {
      usdcContractAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      chainId: 8453,
      serviceLink: 'https://example.com',
      defaultToken: {
        symbol: 'USDC',
        address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        name: 'USD Coin',
        decimals: 6,
        isDefault: true,
        enabled: true
      },
      supportedTokens: [
        {
          symbol: 'USDC',
          address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
          name: 'USD Coin',
          decimals: 6,
          isDefault: true,
          enabled: true
        }
      ]
    },
  }),
}));

jest.mock('@/hooks/useSimpleEthers', () => ({
  useSimpleEthers: () => ({
    getUSDCBalance: jest.fn().mockResolvedValue('10.00'),
    fundAndSendTransaction: jest.fn(),
  }),
}));

jest.mock('next/router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    pathname: '/test',
  }),
}));

// Mock token selection hook
jest.mock('@/hooks/useTokenSelection', () => ({
  useTokenSelection: jest.fn(() => ({
    selectedToken: {
      symbol: 'USDC',
      address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      name: 'USD Coin',
      decimals: 6,
      isDefault: true,
      enabled: true
    },
    selectedTokenSymbol: 'USDC',
    selectedTokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    availableTokens: [
      {
        symbol: 'USDC',
        address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        name: 'USD Coin',
        decimals: 6,
        isDefault: true,
        enabled: true
      }
    ],
    findTokenBySymbol: jest.fn(),
    isTokenAvailable: jest.fn()
  })),
}));

const mockContract: PendingContract = {
  id: 'contract-123',
  sellerEmail: 'seller@example.com',
  buyerEmail: 'buyer@example.com',
  amount: 1000000, // Already in microUSDC format
  currency: 'USDC',
  description: 'Test contract',
  expiryTimestamp: Date.now() + 86400000, // 24 hours from now
  createdAt: Date.now(),
  createdBy: 'seller123',
  state: 'OK' as const,
  status: 'ACTIVE' as const,
  sellerAddress: '0xSellerAddress',
};

describe('ContractAcceptance tokenAddress Regression Prevention', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock window.alert to prevent jsdom errors
    global.alert = jest.fn();

    // Mock the API calls in order
    mockAuthenticatedFetch.mockImplementation((url) => {
      if (url === '/api/contracts/contract-123') {
        // First call - check contract status
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            id: 'contract-123',
            state: 'OK',
            status: 'ACTIVE',
            sellerAddress: '0xSellerAddress',
            amount: 1,
            expiryTimestamp: Date.now() + 86400000
          })
        });
      }
      if (url === '/api/chain/create-contract') {
        // Second call - create contract on blockchain
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ contractAddress: '0xNewContractAddress' })
        });
      }
      // For other calls, return failed response to stop the flow
      return Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ error: 'Test stopped here' })
      });
    });
  });

  it('should include tokenAddress field in create-contract request', async () => {
    const onAcceptComplete = jest.fn();

    render(
      <ContractAcceptance
        contract={mockContract}
        onAcceptComplete={onAcceptComplete}
      />
    );

    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByText(/Make Payment of.*USDC/)).toBeInTheDocument();
    });

    // Click the payment button
    fireEvent.click(screen.getByText(/Make Payment of.*USDC/));

    // Wait for the create-contract API call
    await waitFor(() => {
      expect(mockAuthenticatedFetch).toHaveBeenCalledWith(
        '/api/chain/create-contract',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    // Extract the create-contract call
    const createContractCall = mockAuthenticatedFetch.mock.calls.find(
      call => call[0] === '/api/chain/create-contract'
    );

    expect(createContractCall).toBeDefined();

    const requestBody = JSON.parse(createContractCall[1].body);

    // Critical regression test: tokenAddress must be present and valid
    expect(requestBody).toHaveProperty('tokenAddress');
    expect(requestBody.tokenAddress).toBe('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
    expect(requestBody.tokenAddress).not.toBeNull();
    expect(requestBody.tokenAddress).not.toBeUndefined();
    expect(typeof requestBody.tokenAddress).toBe('string');
    expect(requestBody.tokenAddress.length).toBeGreaterThan(0);
  });

  it('should include all required CreateContractRequest fields', async () => {
    const onAcceptComplete = jest.fn();

    render(
      <ContractAcceptance
        contract={mockContract}
        onAcceptComplete={onAcceptComplete}
      />
    );

    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByText(/Make Payment of.*USDC/)).toBeInTheDocument();
    });

    // Click the payment button
    fireEvent.click(screen.getByText(/Make Payment of.*USDC/));

    // Wait for the create-contract API call
    await waitFor(() => {
      expect(mockAuthenticatedFetch).toHaveBeenCalledWith(
        '/api/chain/create-contract',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    // Extract the create-contract call
    const createContractCall = mockAuthenticatedFetch.mock.calls.find(
      call => call[0] === '/api/chain/create-contract'
    );

    const requestBody = JSON.parse(createContractCall[1].body);

    // Verify all required fields are present according to CreateContractRequest interface
    expect(requestBody).toEqual({
      contractserviceId: 'contract-123',
      tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      buyer: '0xBuyerAddress',
      seller: '0xSellerAddress',
      amount: 1000000, // Already in microUSDC format, passed through as-is
      expiryTimestamp: expect.any(Number),
      description: 'Test contract'
    });

    // Verify types are correct
    expect(typeof requestBody.contractserviceId).toBe('string');
    expect(typeof requestBody.tokenAddress).toBe('string');
    expect(typeof requestBody.buyer).toBe('string');
    expect(typeof requestBody.seller).toBe('string');
    expect(typeof requestBody.amount).toBe('number');
    expect(typeof requestBody.expiryTimestamp).toBe('number');
    expect(typeof requestBody.description).toBe('string');
  });

  it('should NOT include extra fields from PendingContract that chainservice does not expect', async () => {
    const onAcceptComplete = jest.fn();

    render(
      <ContractAcceptance
        contract={mockContract}
        onAcceptComplete={onAcceptComplete}
      />
    );

    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByText(/Make Payment of.*USDC/)).toBeInTheDocument();
    });

    // Click the payment button
    fireEvent.click(screen.getByText(/Make Payment of.*USDC/));

    // Wait for the create-contract API call
    await waitFor(() => {
      expect(mockAuthenticatedFetch).toHaveBeenCalledWith('/api/chain/create-contract', expect.any(Object));
    });

    // Extract the create-contract call
    const createContractCall = mockAuthenticatedFetch.mock.calls.find(
      call => call[0] === '/api/chain/create-contract'
    );

    const requestBody = JSON.parse(createContractCall[1].body);

    // Ensure we're NOT sending extra fields that could confuse the chainservice
    expect(requestBody).not.toHaveProperty('sellerEmail');
    expect(requestBody).not.toHaveProperty('buyerEmail');
    expect(requestBody).not.toHaveProperty('currency');
    expect(requestBody).not.toHaveProperty('createdAt');
    expect(requestBody).not.toHaveProperty('createdBy');
    expect(requestBody).not.toHaveProperty('state');
    expect(requestBody).not.toHaveProperty('status');
    expect(requestBody).not.toHaveProperty('id'); // Using contractserviceId instead

    // Note: description IS now a required field, so we want it to be present
  });

  it('should handle missing config gracefully', async () => {
    // Mock missing config
    jest.doMock('@/components/auth/ConfigProvider', () => ({
      useConfig: () => ({
        config: null,
      }),
    }));

    const onAcceptComplete = jest.fn();

    render(
      <ContractAcceptance
        contract={mockContract}
        onAcceptComplete={onAcceptComplete}
      />
    );

    // Should not allow payment when config is missing
    const paymentButton = screen.queryByText('Make Payment of $1.0000 USDC');
    if (paymentButton) {
      fireEvent.click(paymentButton);
    }

    // Should not make API call without config
    expect(mockAuthenticatedFetch).not.toHaveBeenCalledWith('/api/chain/create-contract', expect.any(Object));
  });

  it('should document the anti-pattern that caused the regression', () => {
    const badPattern = `
    // ❌ BAD: This caused the tokenAddress missing error
    body: JSON.stringify({
      ...contract,  // PendingContract doesn't have tokenAddress!
      amount: contract.amount // Already in microUSDC format
    })
    `;

    const goodPattern = `
    // ✅ GOOD: Explicitly provide all required fields
    body: JSON.stringify({
      contractserviceId: contract.id,
      tokenAddress: config.usdcContractAddress,  // Required field!
      buyer: user.walletAddress,
      seller: contract.sellerAddress,
      amount: contract.amount // Already in microUSDC format,
      expiryTimestamp: contract.expiryTimestamp,
      description: contract.description  // Also required
    })
    `;

    // This test documents the patterns
    expect(badPattern).toContain('...contract');
    expect(goodPattern).toContain('tokenAddress');
  });
});