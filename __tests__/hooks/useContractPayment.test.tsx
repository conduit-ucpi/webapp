/**
 * TDD spec for useContractPayment — the shared payment orchestration extracted
 * from contract-create.tsx and contract-pay.tsx (handleWalletPayment /
 * handleWalletPayment).
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
}));

const mockDirect = sequence.executeDirectPaymentSequence as jest.Mock;

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
    // The escrow address is computed from these, so the hook refuses to pay without them.
    contractFactoryAddress: '0x2e234DAe75C793f67A35089C9d99245E1C58470b',
    implementationAddress: '0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f',
    defaultArbiterAddress: '0x9bB8e809EA6F5A74f46027D8016641D9cE9A149C',
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
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('runDirectPayment', () => {
    it('marks the wallet check done then runs the sequence and calls onSuccess with the result', async () => {
      const { result } = renderHook(() => useContractPayment());

      await act(async () => {
        const p = result.current.runDirectPayment(params, baseDeps());
        await jest.runAllTimersAsync();
        await p;
      });

      expect(setBusy).toHaveBeenCalledWith(true);
      // Completed without ever being 'active': the balance check is synchronous and runs
      // against a figure the page already had, so there is nothing to show in progress. It
      // used to sleep 500ms purely so the tick could be seen appearing.
      expect(updatePaymentStep).toHaveBeenCalledWith('verify', 'completed');
      expect(updatePaymentStep).not.toHaveBeenCalledWith('verify', 'active');
      expect(mockDirect).toHaveBeenCalledTimes(1);
      // The params are passed through unchanged.
      expect(mockDirect.mock.calls[0][0]).toMatchObject(params);
      expect(onSuccess).toHaveBeenCalledWith({ contractAddress: '0xEscrow', transferTxHash: '0xtx' });
      expect(onError).not.toHaveBeenCalled();
    });

    /**
     * Without the factory, implementation and arbiter there is no way to know where the
     * escrow lives. Guessing would hand the buyer an address the factory can never deploy
     * to, and anything sent there would be beyond anyone's reach — so refuse to sign at all.
     */
    it.each(['contractFactoryAddress', 'implementationAddress', 'defaultArbiterAddress'])(
      'refuses to pay when %s is missing',
      async (missing) => {
        const { result } = renderHook(() => useContractPayment());
        const deps: any = { ...baseDeps(), [missing]: undefined };

        await act(async () => {
          const p = result.current.runDirectPayment(params, deps);
          await jest.runAllTimersAsync();
          await p;
        });

        expect(mockDirect).not.toHaveBeenCalled();
        expect(onError).toHaveBeenCalled();
      }
    );

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


  describe('an address the page already prepared', () => {
    /**
     * ⚠️ THE CLICK SHOULD HAVE NOTHING LEFT TO DO BUT ASK FOR A SIGNATURE. The escrow address
     *    is a pure function of terms the page already holds, and recording it is one request —
     *    so the page does both while it sits idle, for the QR code. Not passing the result
     *    through meant the sequence derived and recorded it a second time, putting two round
     *    trips between pressing Pay and the wallet opening, for work already finished.
     */
    it('passes the prepared address through to the sequence', async () => {
      const { result } = renderHook(() => useContractPayment());

      await act(async () => {
        await result.current.runDirectPayment(params, {
          ...baseDeps(),
          preparedAddress: '0xAlreadyKnown'
        });
      });

      expect(mockDirect.mock.calls[0][1].preparedAddress).toBe('0xAlreadyKnown');
    });

    it('leaves it undefined when the page had not got there yet', async () => {
      // An interrupted load, or a caller that never prepared. The sequence derives it itself
      // and reaches the same address, because it comes from the terms rather than from anyone.
      const { result } = renderHook(() => useContractPayment());

      await act(async () => {
        await result.current.runDirectPayment(params, baseDeps());
      });

      expect(mockDirect.mock.calls[0][1].preparedAddress).toBeUndefined();
    });
  });
});
