/**
 * Regression test: the expiryTimestamp stored in the contractservice DB
 * MUST match the expiryTimestamp sent to chainservice on deploy.
 *
 * Bug history: the page recomputed `Math.floor(Date.now() / 1000) + 7d`
 * twice — once at pending-contract creation (DB write) and again at deploy
 * (on-chain write). Any time that elapsed between the two calls produced
 * drift (observed: 8 seconds on a real contract), which contractservice
 * flagged as `expiryTimestampMismatch` → status ERROR.
 *
 * Fix: capture the DB-bound value in React state at create time and reuse
 * it at deploy time.
 *
 * What this test guards:
 *   1. DB expiryTimestamp == chainservice expiryTimestamp (regression)
 *   2. Both equal the user-supplied `epoch_expiry` query param (correctness)
 *   3. Default path sends identical values to both sides even when
 *      wall-clock advances between the two calls.
 *
 * This test drives the QR-flow deploy path (`createContractForQR`), which
 * consumes the same `pendingExpiryTimestamp` state as the wallet deploy
 * path — so it covers the identical regression without needing to mock
 * token balances.
 */

import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { useRouter } from 'next/router';
import ContractCreate from '@/pages/contract-create';

jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

const mockAuthenticatedFetch = jest.fn();
const mockValidateForm = jest.fn(() => true);
const mockGetWeb3Service = jest.fn();

jest.mock('@/components/auth', () => ({
  useAuth: () => ({
    user: {
      userId: '1',
      email: 'test@example.com',
      walletAddress: '0x1234567890123456789012345678901234567890',
      authProvider: 'web3auth',
    },
    isLoading: false,
    isLoadingUserData: false,
    isConnected: true,
    address: '0x1234567890123456789012345678901234567890',
    disconnect: jest.fn(),
    authenticatedFetch: mockAuthenticatedFetch,
    getEthersProvider: jest.fn(),
    refreshUserData: jest.fn(),
  }),
}));

const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

jest.mock('@/components/auth/ConfigProvider', () => ({
  useConfig: () => ({
    config: {
      chainId: 8453,
      rpcUrl: 'https://mainnet.base.org',
      usdcContractAddress: USDC_ADDRESS,
      contractFactoryAddress: '0xFactory',
      userServiceUrl: 'http://localhost:8977',
      chainServiceUrl: 'http://localhost:8978',
      contractServiceUrl: 'http://localhost:8080',
      serviceLink: 'https://test.example.com',
      defaultTokenSymbol: 'USDC',
      tokenSymbol: 'USDC',
      usdcDetails: {
        symbol: 'USDC',
        name: 'USD Coin',
        address: USDC_ADDRESS,
        decimals: 6,
      },
      primaryToken: {
        symbol: 'USDC',
        address: USDC_ADDRESS,
        decimals: 6,
        name: 'USD Coin',
      },
    },
    isLoading: false,
  }),
}));

jest.mock('@/hooks/useSimpleEthers', () => ({
  useSimpleEthers: () => ({
    approveUSDC: jest.fn(),
    depositToContract: jest.fn(),
    depositFundsAsProxy: jest.fn(),
    getWeb3Service: mockGetWeb3Service,
    transferToContract: jest.fn(),
    getTokenBalance: jest.fn().mockResolvedValue('1000'),
  }),
}));

jest.mock('@/hooks/useContractValidation', () => ({
  useContractCreateValidation: () => ({
    errors: {},
    validateForm: mockValidateForm,
    clearErrors: jest.fn(),
  }),
}));

// Mock ethers to avoid real RPC calls (statically imported instances)
jest.mock('ethers', () => {
  const originalModule = jest.requireActual('ethers');
  return {
    ...originalModule,
    JsonRpcProvider: jest.fn().mockImplementation(() => ({
      getCode: jest.fn().mockResolvedValue('0x'),
      getBalance: jest.fn().mockResolvedValue(BigInt('1000000000000000000')),
    })),
    Contract: jest.fn().mockImplementation(() => ({
      balanceOf: jest.fn().mockResolvedValue(BigInt('500000000000')),
      decimals: jest.fn().mockResolvedValue(6),
    })),
  };
});

/**
 * Extract the expiryTimestamp sent to /api/contracts (the DB write).
 */
function getDbExpiry(): number | null {
  const call = mockAuthenticatedFetch.mock.calls.find(
    (c) => c[0] === '/api/contracts' && c[1]?.method === 'POST',
  );
  if (!call) return null;
  const body = JSON.parse(call[1].body);
  return body.expiryTimestamp;
}

/**
 * Extract the expiryTimestamp sent to /api/chain/create-contract (the on-chain write).
 */
function getChainExpiry(): number | null {
  const call = mockAuthenticatedFetch.mock.calls.find(
    (c) => c[0] === '/api/chain/create-contract' && c[1]?.method === 'POST',
  );
  if (!call) return null;
  const body = JSON.parse(call[1].body);
  return body.expiryTimestamp;
}

describe('ContractCreate — expiryTimestamp consistency between DB and chain', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateForm.mockReturnValue(true);

    mockAuthenticatedFetch.mockImplementation((url: string, options?: RequestInit) => {
      if (url === '/api/contracts' && options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ contractId: 'test-contract-id' }),
        });
      }
      if (url === '/api/chain/create-contract' && options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              contractAddress: '0xdeployed',
              // No transactionHash so we skip the waitForTransaction call
            }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
  });

  test('user-supplied epoch_expiry reaches both DB and chain unchanged', async () => {
    const userRequestedExpiry = 1800000000; // fixed absolute timestamp

    (useRouter as jest.Mock).mockReturnValue({
      query: {
        seller: '0x9876543210987654321098765432109876543210',
        amount: '10.00',
        description: 'Test purchase',
        epoch_expiry: String(userRequestedExpiry),
      },
      push: jest.fn(),
      pathname: '/contract-create',
      route: '/contract-create',
      asPath: '/contract-create',
    });

    render(<ContractCreate />);

    // 1. Click "Pay" / "Create Payment" to create the pending contract (DB write).
    const createBtn = await screen.findByRole(
      'button',
      { name: /^(pay|create payment)$/i },
      { timeout: 3000 },
    );
    await act(async () => {
      fireEvent.click(createBtn);
    });

    await waitFor(() => expect(getDbExpiry()).toBe(userRequestedExpiry), {
      timeout: 3000,
    });

    // 2. Choose the QR flow, which invokes createContractForQR → /api/chain/create-contract.
    const qrMethodBtn = await screen.findByRole(
      'button',
      { name: /pay by link \/ qr code/i },
      { timeout: 3000 },
    );
    await act(async () => {
      fireEvent.click(qrMethodBtn);
    });

    const generateBtn = await screen.findByRole(
      'button',
      { name: /generate payment link/i },
      { timeout: 3000 },
    );
    await act(async () => {
      fireEvent.click(generateBtn);
    });

    await waitFor(() => expect(getChainExpiry()).not.toBeNull(), { timeout: 5000 });

    // CORRECTNESS: chain expiry == user-requested value
    expect(getChainExpiry()).toBe(userRequestedExpiry);
    // REGRESSION GUARD: DB expiry == chain expiry
    expect(getChainExpiry()).toBe(getDbExpiry());
  });

  test('default path sends identical values to DB and chain even when wall-clock advances', async () => {
    (useRouter as jest.Mock).mockReturnValue({
      query: {
        seller: '0x9876543210987654321098765432109876543210',
        amount: '10.00',
        description: 'Test purchase',
        // no epoch_expiry — triggers the default "now + 7d" branch
      },
      push: jest.fn(),
      pathname: '/contract-create',
      route: '/contract-create',
      asPath: '/contract-create',
    });

    render(<ContractCreate />);

    const createBtn = await screen.findByRole(
      'button',
      { name: /^(pay|create payment)$/i },
      { timeout: 3000 },
    );
    await act(async () => {
      fireEvent.click(createBtn);
    });

    await waitFor(() => expect(getDbExpiry()).not.toBeNull(), { timeout: 3000 });
    const dbExpiry = getDbExpiry()!;

    // Sleep longer than the 8s drift observed on the real broken contract.
    // If the deploy path recomputes from Date.now(), chain expiry will be
    // larger than dbExpiry and the final assertion will fail.
    await new Promise((r) => setTimeout(r, 1100));

    const qrMethodBtn = await screen.findByRole(
      'button',
      { name: /pay by link \/ qr code/i },
      { timeout: 3000 },
    );
    await act(async () => {
      fireEvent.click(qrMethodBtn);
    });

    const generateBtn = await screen.findByRole(
      'button',
      { name: /generate payment link/i },
      { timeout: 3000 },
    );
    await act(async () => {
      fireEvent.click(generateBtn);
    });

    await waitFor(() => expect(getChainExpiry()).not.toBeNull(), { timeout: 5000 });

    // REGRESSION GUARD: the two must be bit-for-bit identical, not just "close"
    expect(getChainExpiry()).toBe(dbExpiry);
  });
});
