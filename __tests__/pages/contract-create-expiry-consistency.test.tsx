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
// Stable reference: the real useSimpleEthers wraps getTokenBalance in
// useCallback, so it must be stable across renders. A fresh jest.fn() per
// render would re-fire the balance-fetch effect (which now depends on it) and
// loop forever. Mirror production by hoisting one stable mock.
const mockGetTokenBalance = jest.fn().mockResolvedValue('1000');

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

import { predictEscrowAddress } from '@/lib/counterfactualAddress';

const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const TEST_FACTORY = '0x2e234DAe75C793f67A35089C9d99245E1C58470b';
const TEST_IMPLEMENTATION = '0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f';
const TEST_ARBITER = '0x9bB8e809EA6F5A74f46027D8016641D9cE9A149C';

jest.mock('@/components/auth/ConfigProvider', () => ({
  useConfig: () => ({
    config: {
      chainId: 8453,
      rpcUrl: 'https://mainnet.base.org',
      usdcContractAddress: USDC_ADDRESS,
      contractFactoryAddress: TEST_FACTORY,
      contractAddress: TEST_IMPLEMENTATION,
      defaultArbiterAddress: TEST_ARBITER,
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
    getTokenBalance: mockGetTokenBalance,
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
 * The escrow address the page reserved.
 *
 * There is no longer an expiryTimestamp on the wire to inspect at this point: the escrow is
 * not deployed when the QR is shown, and the expiry is consumed locally to compute where it
 * will live. The address IS the expiry, along with every other term — so asserting it against
 * an independently computed prediction is a strictly stronger check than reading a number out
 * of a request body. Recompute the expiry from Date.now() and this no longer matches.
 */
function getReservedAddress(): string | null {
  const call = mockAuthenticatedFetch.mock.calls.find(
    (c) => typeof c[0] === 'string' && c[0].startsWith('/api/contracts/') && c[1]?.method === 'PATCH',
  );
  if (!call) return null;
  return JSON.parse(call[1].body).chainAddress ?? null;
}

/** Where an escrow carrying this expiry, and the terms the test filled in, must live. */
function addressForExpiry(expiryTimestamp: number): string {
  return predictEscrowAddress(TEST_FACTORY, TEST_IMPLEMENTATION, {
    tokenAddress: USDC_ADDRESS,
    buyer: '0x1234567890123456789012345678901234567890',
    seller: '0x9876543210987654321098765432109876543210',
    amount: 10_000_000,
    expiryTimestamp,
    arbiter: TEST_ARBITER,
    contractserviceId: 'test-contract-id',
  });
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
      if (url.startsWith('/api/contracts/') && options?.method === 'PATCH') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 'test-contract-id' }) });
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

    await waitFor(() => expect(getReservedAddress()).not.toBeNull(), { timeout: 5000 });

    // CORRECTNESS: the address the buyer is sent to is the one the user-requested expiry
    // produces. Any other expiry names a different escrow.
    expect(getReservedAddress()).toBe(addressForExpiry(userRequestedExpiry));
    // REGRESSION GUARD: the address is derived from the SAME expiry the DB holds. This is
    // what the old "chain expiry == DB expiry" check meant, now that the expiry reaches the
    // chain as part of the address rather than as a field.
    expect(getReservedAddress()).toBe(addressForExpiry(getDbExpiry()!));
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

    await waitFor(() => expect(getReservedAddress()).not.toBeNull(), { timeout: 5000 });

    // REGRESSION GUARD: the two must be bit-for-bit identical, not just "close"
    expect(getReservedAddress()).toBe(addressForExpiry(dbExpiry));
  });
});
