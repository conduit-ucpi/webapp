/**
 * TDD spec for useContractPayment — the shared payment orchestration extracted
 * from contract-create.tsx and contract-pay.tsx (handleWalletPayment /
 * handleLegacyPayment).
 *
 * The hook owns the SHARED core, identical between both pages:
 *   - reset steps → balance check (throw on insufficient, exact message) →
 *     verify step (active, 500ms pause, completed) → run the sequence with the
 *     shared onProgress step-wiring → on success call onSuccess(result);
 *     on error, mark the active step 'error' and call onError(error).
 * The PAGE-SPECIFIC tails (webhook/Shopify/postMessage/WordPress redirect vs.
 * router.push; alert vs. postMessage error) are injected as onSuccess/onError
 * so they stay in the pages.
 *
 * The actual signing is executeDirectPaymentSequence / executeContractTransaction
 * Sequence — mocked here. We assert the hook drives them and the step/loading
 * side-effects correctly, NOT the on-chain mechanics (those have their own
 * util-level tests).
 */

import { renderHook, act } from '@testing-library/react';
import { useContractPayment } from '@/hooks/useContractPayment';
import * as sequence from '@/utils/contractTransactionSequence';

jest.mock('@/utils/contractTransactionSequence', () => ({
  executeDirectPaymentSequence: jest.fn(),
  executeContractTransactionSequence: jest.fn(),
}));

const mockDirect = sequence.executeDirectPaymentSequence as jest.Mock;
const mockLegacy = sequence.executeContractTransactionSequence as jest.Mock;

describe('useContractPayment', () => {
  let updatePaymentStep: jest.Mock;
  let setLoadingMessage: jest.Mock;
  let setBusy: jest.Mock;
  let onSuccess: jest.Mock;
  let onError: jest.Mock;
  let getPaymentSteps: jest.Mock;

  const params = {
    contractserviceId: 'c1',
    tokenAddress: '0xToken',
    buyer: '0xBuyer',
    seller: '0xSeller',
    amount: 10_000_000, // micro
    expiryTimestamp: 1780000000,
    description: 'Test',
  };

  const baseDeps = () => ({
    selectedTokenSymbol: 'USDC',
    tokenBalance: '50', // plenty
    requiredAmount: 10, // token units
    authenticatedFetch: jest.fn(),
    transferToContract: jest.fn(),
    approveUSDC: jest.fn(),
    depositToContract: jest.fn(),
    depositFundsAsProxy: jest.fn(),
    getWeb3Service: jest.fn(),
    updatePaymentStep,
    setLoadingMessage,
    setBusy,
    getActiveStep: () => getPaymentSteps(),
    onSuccess,
    onError,
  });

  beforeEach(() => {
    jest.useFakeTimers();
    updatePaymentStep = jest.fn();
    setLoadingMessage = jest.fn();
    setBusy = jest.fn();
    onSuccess = jest.fn();
    onError = jest.fn();
    getPaymentSteps = jest.fn().mockReturnValue(undefined);
    mockDirect.mockResolvedValue({ contractAddress: '0xEscrow', transferTxHash: '0xtx' });
    mockLegacy.mockResolvedValue({ contractAddress: '0xEscrow', depositTxHash: '0xdep' });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('runDirectPayment', () => {
    it('runs the verify step then executeDirectPaymentSequence and calls onSuccess with the result', async () => {
      const { result } = renderHook(() => useContractPayment());

      await act(async () => {
        const p = result.current.runDirectPayment(params, baseDeps());
        await jest.runAllTimersAsync();
        await p;
      });

      expect(setBusy).toHaveBeenCalledWith(true);
      expect(updatePaymentStep).toHaveBeenCalledWith('verify', 'active');
      expect(updatePaymentStep).toHaveBeenCalledWith('verify', 'completed');
      expect(mockDirect).toHaveBeenCalledTimes(1);
      // The params are passed through unchanged.
      expect(mockDirect.mock.calls[0][0]).toMatchObject(params);
      expect(onSuccess).toHaveBeenCalledWith({ contractAddress: '0xEscrow', transferTxHash: '0xtx' });
      expect(onError).not.toHaveBeenCalled();
    });

    it('throws before signing when balance is insufficient, with the exact message, and calls onError', async () => {
      const { result } = renderHook(() => useContractPayment());
      const deps = { ...baseDeps(), tokenBalance: '3', requiredAmount: 10 };

      await act(async () => {
        const p = result.current.runDirectPayment(params, deps);
        await jest.runAllTimersAsync();
        await p;
      });

      expect(mockDirect).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalledTimes(1);
      const err = onError.mock.calls[0][0] as Error;
      expect(err.message).toContain('Insufficient USDC balance');
      expect(err.message).toContain('You need 10.0000 USDC');
      expect(err.message).toContain('only have 3.0000 USDC');
      expect(err.message).toContain('short 7.0000 USDC');
      expect(onSuccess).not.toHaveBeenCalled();
    });

    it('wires onProgress steps to updatePaymentStep (transfer→confirm→activate→complete)', async () => {
      // Make the sequence invoke onProgress with the canonical steps.
      mockDirect.mockImplementation(async (_p, opts) => {
        opts.onProgress?.('transfer', 'x');
        opts.onProgress?.('transfer_confirmation', 'x');
        opts.onProgress?.('activation', 'x');
        opts.onProgress?.('complete', 'x');
        return { contractAddress: '0xEscrow', transferTxHash: '0xtx' };
      });

      const { result } = renderHook(() => useContractPayment());
      await act(async () => {
        const p = result.current.runDirectPayment(params, baseDeps());
        await jest.runAllTimersAsync();
        await p;
      });

      expect(updatePaymentStep).toHaveBeenCalledWith('transfer', 'completed');
      expect(updatePaymentStep).toHaveBeenCalledWith('confirm', 'active');
      expect(updatePaymentStep).toHaveBeenCalledWith('activate', 'active');
      expect(updatePaymentStep).toHaveBeenCalledWith('complete', 'completed');
    });

    it('marks the active step as error and calls onError when the sequence throws', async () => {
      mockDirect.mockRejectedValue(new Error('chain boom'));
      getPaymentSteps.mockReturnValue({ id: 'transfer', status: 'active' });

      const { result } = renderHook(() => useContractPayment());
      await act(async () => {
        const p = result.current.runDirectPayment(params, baseDeps());
        await jest.runAllTimersAsync();
        await p;
      });

      expect(updatePaymentStep).toHaveBeenCalledWith('transfer', 'error');
      expect(onError).toHaveBeenCalledTimes(1);
      expect((onError.mock.calls[0][0] as Error).message).toBe('chain boom');
      expect(onSuccess).not.toHaveBeenCalled();
    });
  });

  describe('runLegacyPayment', () => {
    it('runs executeContractTransactionSequence with useProxyDeposit and calls onSuccess', async () => {
      const { result } = renderHook(() => useContractPayment());
      await act(async () => {
        const p = result.current.runLegacyPayment(params, baseDeps());
        await jest.runAllTimersAsync();
        await p;
      });

      expect(mockLegacy).toHaveBeenCalledTimes(1);
      expect(mockLegacy.mock.calls[0][1]).toMatchObject({ useProxyDeposit: true });
      expect(onSuccess).toHaveBeenCalledWith({ contractAddress: '0xEscrow', depositTxHash: '0xdep' });
    });

    it('throws on insufficient balance before signing (legacy path)', async () => {
      const { result } = renderHook(() => useContractPayment());
      const deps = { ...baseDeps(), tokenBalance: '0', requiredAmount: 10 };
      await act(async () => {
        const p = result.current.runLegacyPayment(params, deps);
        await jest.runAllTimersAsync();
        await p;
      });
      expect(mockLegacy).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalled();
    });
  });
});
