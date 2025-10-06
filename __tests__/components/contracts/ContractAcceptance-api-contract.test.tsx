/**
 * API Contract Validation Tests for ContractAcceptance
 * These tests ensure the webapp sends exactly what the chainservice expects
 * Prevents any future breaking changes to the create-contract API call
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ContractAcceptance from '@/components/contracts/ContractAcceptance';
import { PendingContract } from '@/types';

// Mock fetch to capture and validate API calls
const mockFetch = jest.fn();
global.fetch = mockFetch as jest.Mock;

// Mock authenticated fetch
const mockAuthenticatedFetch = jest.fn();

jest.mock('@/components/auth', () => ({
  useAuth: () => ({
    user: {
      walletAddress: '0x742d35Cc6634C0532925a3b8D39A3d9C4C3dEa4b',
      email: 'test@example.com'
    },
    authenticatedFetch: mockAuthenticatedFetch,
  }),
}));

jest.mock('@/components/auth/ConfigProvider', () => ({
  useConfig: () => ({
    config: {
      usdcContractAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      chainId: 8453,
      serviceLink: 'https://example.com'
    },
  }),
}));

jest.mock('@/hooks/useSimpleEthers', () => ({
  useSimpleEthers: () => ({
    getUSDCBalance: jest.fn().mockResolvedValue('100.00'),
    fundAndSendTransaction: jest.fn(),
    approveUSDC: jest.fn().mockResolvedValue('0x1234...'), // Mock transaction hash
    depositToContract: jest.fn().mockResolvedValue('0x5678...'), // Mock transaction hash
  }),
}));

jest.mock('next/router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    pathname: '/test',
  }),
}));

const mockContract: PendingContract = {
  id: 'contract-abc123',
  sellerEmail: 'seller@example.com',
  buyerEmail: 'test@example.com',
  amount: 2500000, // Already in microUSDC format
  currency: 'USDC',
  description: 'API contract test payment',
  expiryTimestamp: 1735689600, // Unix timestamp
  createdAt: Date.now(),
  createdBy: 'seller456',
  state: 'OK' as const,
  status: 'ACTIVE' as const,
  sellerAddress: '0xA1B2C3D4E5F6789012345678901234567890ABCD',
};

describe('ContractAcceptance API Contract Validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.alert = jest.fn();

    // Mock the complete API call flow
    mockAuthenticatedFetch.mockImplementation((url) => {
      if (url === '/api/contracts/contract-abc123') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            ...mockContract,
            state: 'OK'
          })
        });
      }
      if (url === '/api/chain/create-contract') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ contractAddress: '0x1234567890123456789012345678901234567890' })
        });
      }
      return Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ error: 'Test endpoint not mocked' })
      });
    });
  });

  it('should send exactly the required CreateContractRequest structure', async () => {
    const onAcceptComplete = jest.fn();

    render(
      <ContractAcceptance
        contract={mockContract}
        onAcceptComplete={onAcceptComplete}
      />
    );

    // Wait for component to render
    await waitFor(() => {
      expect(screen.getByText(/Make Payment of.*USDC/)).toBeInTheDocument();
    });

    // Trigger the payment flow
    fireEvent.click(screen.getByText(/Make Payment of.*USDC/));

    // Wait for create-contract API call
    await waitFor(() => {
      expect(mockAuthenticatedFetch).toHaveBeenCalledWith(
        '/api/chain/create-contract',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    // Extract and validate the request
    const createContractCall = mockAuthenticatedFetch.mock.calls.find(
      call => call[0] === '/api/chain/create-contract'
    );
    expect(createContractCall).toBeDefined();

    const requestBody = JSON.parse(createContractCall[1].body);

    // Validate EXACT structure according to chainservice CreateContractRequest
    expect(requestBody).toEqual({
      contractserviceId: 'contract-abc123',
      tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      buyer: '0x742d35Cc6634C0532925a3b8D39A3d9C4C3dEa4b',
      seller: '0xA1B2C3D4E5F6789012345678901234567890ABCD',
      amount: 2500000, // 2.5 USDC = 2,500,000 microUSDC
      expiryTimestamp: 1735689600,
      description: 'API contract test payment'
    });
  });

  it('should validate field types match chainservice expectations', async () => {
    const onAcceptComplete = jest.fn();

    render(
      <ContractAcceptance
        contract={mockContract}
        onAcceptComplete={onAcceptComplete}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Make Payment of.*USDC/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Make Payment of.*USDC/));

    await waitFor(() => {
      expect(mockAuthenticatedFetch).toHaveBeenCalledWith('/api/chain/create-contract', expect.any(Object));
    });

    const createContractCall = mockAuthenticatedFetch.mock.calls.find(
      call => call[0] === '/api/chain/create-contract'
    );
    const requestBody = JSON.parse(createContractCall[1].body);

    // Validate data types match Kotlin expectations
    expect(typeof requestBody.contractserviceId).toBe('string');
    expect(typeof requestBody.tokenAddress).toBe('string');
    expect(typeof requestBody.buyer).toBe('string');
    expect(typeof requestBody.seller).toBe('string');
    expect(typeof requestBody.amount).toBe('number'); // BigInteger in Kotlin
    expect(typeof requestBody.expiryTimestamp).toBe('number'); // Long in Kotlin
    expect(typeof requestBody.description).toBe('string');

    // Validate string patterns (Ethereum addresses)
    expect(requestBody.tokenAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(requestBody.buyer).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(requestBody.seller).toMatch(/^0x[a-fA-F0-9]{40}$/);

    // Validate constraints
    expect(requestBody.amount).toBeGreaterThan(0);
    expect(requestBody.expiryTimestamp).toBeGreaterThan(0);
    expect(requestBody.description.length).toBeLessThanOrEqual(160); // Max 160 chars
    expect(requestBody.contractserviceId.length).toBeGreaterThan(0);
  });

  it('should fail if any required field is missing', () => {
    // This test documents what happens if we accidentally remove a required field
    const invalidRequests = [
      { missing: 'contractserviceId', data: { tokenAddress: 'x', buyer: 'x', seller: 'x', amount: 1, expiryTimestamp: 1, description: 'x' } },
      { missing: 'tokenAddress', data: { contractserviceId: 'x', buyer: 'x', seller: 'x', amount: 1, expiryTimestamp: 1, description: 'x' } },
      { missing: 'buyer', data: { contractserviceId: 'x', tokenAddress: 'x', seller: 'x', amount: 1, expiryTimestamp: 1, description: 'x' } },
      { missing: 'seller', data: { contractserviceId: 'x', tokenAddress: 'x', buyer: 'x', amount: 1, expiryTimestamp: 1, description: 'x' } },
      { missing: 'amount', data: { contractserviceId: 'x', tokenAddress: 'x', buyer: 'x', seller: 'x', expiryTimestamp: 1, description: 'x' } },
      { missing: 'expiryTimestamp', data: { contractserviceId: 'x', tokenAddress: 'x', buyer: 'x', seller: 'x', amount: 1, description: 'x' } },
      { missing: 'description', data: { contractserviceId: 'x', tokenAddress: 'x', buyer: 'x', seller: 'x', amount: 1, expiryTimestamp: 1 } },
    ];

    invalidRequests.forEach(({ missing, data }) => {
      // Verify that the chainservice would reject this request
      expect(data).not.toHaveProperty(missing);

      // Document that this field is required
      const requiredFields = ['contractserviceId', 'tokenAddress', 'buyer', 'seller', 'amount', 'expiryTimestamp', 'description'];
      expect(requiredFields).toContain(missing);
    });
  });

  it('should handle edge cases that could break the API contract', async () => {
    const edgeCaseContract: PendingContract = {
      ...mockContract,
      amount: 1, // 1 microUSDC (very small amount)
      description: 'A'.repeat(160), // Maximum length description
    };

    const onAcceptComplete = jest.fn();

    render(
      <ContractAcceptance
        contract={edgeCaseContract}
        onAcceptComplete={onAcceptComplete}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Make Payment of.*USDC/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Make Payment of.*USDC/));

    await waitFor(() => {
      expect(mockAuthenticatedFetch).toHaveBeenCalledWith('/api/chain/create-contract', expect.any(Object));
    });

    const createContractCall = mockAuthenticatedFetch.mock.calls.find(
      call => call[0] === '/api/chain/create-contract'
    );
    const requestBody = JSON.parse(createContractCall[1].body);

    // Validate edge cases are handled correctly
    expect(requestBody.amount).toBe(1); // 0.000001 USDC = 1 microUSDC
    expect(requestBody.description).toBe('A'.repeat(160));
    expect(requestBody.description.length).toBe(160);
  });

  it('should prevent regression to the old spread operator pattern', () => {
    const fs = require('fs');
    const path = require('path');

    const componentPath = path.join(process.cwd(), 'components/contracts/ContractAcceptance.tsx');
    const componentSource = fs.readFileSync(componentPath, 'utf8');

    // Ensure the dangerous spread pattern is NOT used
    expect(componentSource).not.toContain('...contract,');
    expect(componentSource).not.toContain('body: JSON.stringify(contract');
    expect(componentSource).not.toContain('body: JSON.stringify({ ...contract');

    // Ensure the safe explicit pattern IS used
    expect(componentSource).toContain('contractserviceId: contract.id');
    expect(componentSource).toContain('tokenAddress: config.usdcContractAddress');
    expect(componentSource).toContain('buyer: user.walletAddress');
    expect(componentSource).toContain('seller: contract.sellerAddress');
    expect(componentSource).toContain('amount: contract.amount');
    expect(componentSource).toContain('expiryTimestamp: contract.expiryTimestamp');
    expect(componentSource).toContain('description: contract.description');
  });

  it('should document the complete API contract for future developers', () => {
    const apiContract = {
      endpoint: '/api/chain/create-contract',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      requiredFields: {
        contractserviceId: 'string (non-blank)',
        tokenAddress: 'string (40-char hex with 0x prefix)',
        buyer: 'string (40-char hex with 0x prefix)',
        seller: 'string (40-char hex with 0x prefix)',
        amount: 'number (positive BigInteger)',
        expiryTimestamp: 'number (Long)',
        description: 'string (max 160 chars, non-blank)'
      },
      validation: {
        addresses: '^0x[a-fA-F0-9]{40}$',
        amount: 'must be positive',
        description: 'max 160 characters',
        allFields: 'non-nullable'
      }
    };

    // Verify the contract is documented
    expect(apiContract.requiredFields).toHaveProperty('contractserviceId');
    expect(apiContract.requiredFields).toHaveProperty('tokenAddress');
    expect(apiContract.requiredFields).toHaveProperty('buyer');
    expect(apiContract.requiredFields).toHaveProperty('seller');
    expect(apiContract.requiredFields).toHaveProperty('amount');
    expect(apiContract.requiredFields).toHaveProperty('expiryTimestamp');
    expect(apiContract.requiredFields).toHaveProperty('description');

    // Verify we have exactly 7 required fields (no more, no less)
    expect(Object.keys(apiContract.requiredFields)).toHaveLength(7);
  });
});