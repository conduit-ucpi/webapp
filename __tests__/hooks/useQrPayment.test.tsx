/**
 * TDD spec for useQrPayment — the QR-payment subsystem extracted (verbatim in
 * behavior) from contract-create.tsx and contract-pay.tsx.
 *
 * Written BEFORE the hook exists. These tests define the contract:
 *  - countdown timer (1s tick, fires checkAndActivate at zero)
 *  - balance polling every 10s, sets paymentDetected when balance >= required
 *  - checkAndActivate POSTs /api/chain/check-and-activate and drives status,
 *    invoking the page-specific onActivated callback on success
 *  - createContract delegates to the page-supplied creator, stores the address,
 *    resets the countdown to 240
 *  - buildEip681Uri / formatCountdown pure helpers
 *  - intervals are cleared on unmount and on success (no leaks)
 *
 * The page-specific bits (how to create the on-chain contract, what the
 * required amount is, what happens on activation) are injected via params so
 * the same hook serves both pages without behavior change.
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useQrPayment } from '@/hooks/useQrPayment';

describe('useQrPayment', () => {
  let mockAuthenticatedFetch: jest.Mock;
  let mockGetTokenBalance: jest.Mock;
  let mockCreateContract: jest.Mock;
  let mockOnActivated: jest.Mock;

  const baseParams = () => ({
    authenticatedFetch: mockAuthenticatedFetch,
    getTokenBalance: mockGetTokenBalance,
    selectedTokenAddress: '0xToken',
    chainId: 8453,
    requiredAmount: 10, // in token units (not micro)
    requiredAmountMicro: 10_000_000, // micro for the EIP-681 uri
    createContract: mockCreateContract,
    onActivated: mockOnActivated,
  });

  beforeEach(() => {
    jest.useFakeTimers();
    mockAuthenticatedFetch = jest.fn();
    mockGetTokenBalance = jest.fn().mockResolvedValue('0');
    mockCreateContract = jest.fn().mockResolvedValue('0xEscrow');
    mockOnActivated = jest.fn();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('initial state', () => {
    it('starts idle with no contract address and a 240s countdown', () => {
      const { result } = renderHook(() => useQrPayment(baseParams()));
      expect(result.current.qrContractAddress).toBeNull();
      expect(result.current.qrActivationStatus).toBe('idle');
      expect(result.current.qrPaymentDetected).toBe(false);
      expect(result.current.qrCountdown).toBe(240);
      expect(result.current.isCreatingContract).toBe(false);
    });
  });

  describe('createContract', () => {
    it('delegates to the supplied creator, stores the resolved address, resets countdown to 240', async () => {
      const { result } = renderHook(() => useQrPayment(baseParams()));

      await act(async () => {
        await result.current.createContract();
      });

      expect(mockCreateContract).toHaveBeenCalledTimes(1);
      expect(result.current.qrContractAddress).toBe('0xEscrow');
      expect(result.current.qrCountdown).toBe(240);
      expect(result.current.isCreatingContract).toBe(false);
    });

    it('does not store an address when the creator returns nothing (failure)', async () => {
      mockCreateContract.mockResolvedValue(undefined);
      const { result } = renderHook(() => useQrPayment(baseParams()));

      await act(async () => {
        await result.current.createContract();
      });

      expect(result.current.qrContractAddress).toBeNull();
    });
  });

  describe('countdown timer', () => {
    it('ticks down once per second after an address is set', async () => {
      const { result } = renderHook(() => useQrPayment(baseParams()));
      await act(async () => {
        await result.current.createContract();
      });

      expect(result.current.qrCountdown).toBe(240);
      act(() => {
        jest.advanceTimersByTime(3000);
      });
      expect(result.current.qrCountdown).toBe(237);
    });

    it('fires checkAndActivate when the countdown reaches zero', async () => {
      mockAuthenticatedFetch.mockResolvedValue({ json: async () => ({ success: false }) });
      const { result } = renderHook(() => useQrPayment(baseParams()));
      await act(async () => {
        await result.current.createContract();
      });

      await act(async () => {
        jest.advanceTimersByTime(240_000);
      });

      expect(mockAuthenticatedFetch).toHaveBeenCalledWith(
        '/api/chain/check-and-activate',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('balance polling', () => {
    it('polls the contract balance and sets paymentDetected once balance >= required', async () => {
      mockGetTokenBalance.mockResolvedValue('10'); // meets requiredAmount of 10
      const { result } = renderHook(() => useQrPayment(baseParams()));
      await act(async () => {
        await result.current.createContract();
      });

      // The immediate poll fires on the effect; flush it.
      await act(async () => {
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(result.current.qrPaymentDetected).toBe(true);
      });
      expect(mockGetTokenBalance).toHaveBeenCalledWith('0xEscrow', '0xToken');
    });

    it('does not set paymentDetected when balance is below required', async () => {
      mockGetTokenBalance.mockResolvedValue('5');
      const { result } = renderHook(() => useQrPayment(baseParams()));
      await act(async () => {
        await result.current.createContract();
      });
      await act(async () => {
        await Promise.resolve();
      });
      expect(result.current.qrPaymentDetected).toBe(false);
    });
  });

  describe('checkAndActivate', () => {
    it('sets status to success and calls onActivated when the backend reports success', async () => {
      mockAuthenticatedFetch.mockResolvedValue({ json: async () => ({ success: true }) });
      const { result } = renderHook(() => useQrPayment(baseParams()));
      await act(async () => {
        await result.current.createContract();
      });

      await act(async () => {
        await result.current.checkAndActivate();
      });

      expect(result.current.qrActivationStatus).toBe('success');
      expect(mockOnActivated).toHaveBeenCalledWith('0xEscrow');
    });

    it('sets status to waiting (not success) when the backend reports not-successful', async () => {
      mockAuthenticatedFetch.mockResolvedValue({ json: async () => ({ success: false }) });
      const { result } = renderHook(() => useQrPayment(baseParams()));
      await act(async () => {
        await result.current.createContract();
      });

      await act(async () => {
        await result.current.checkAndActivate();
      });

      expect(result.current.qrActivationStatus).toBe('waiting');
      expect(mockOnActivated).not.toHaveBeenCalled();
    });

    it('sets status to waiting when the request throws', async () => {
      mockAuthenticatedFetch.mockRejectedValue(new Error('network'));
      const { result } = renderHook(() => useQrPayment(baseParams()));
      await act(async () => {
        await result.current.createContract();
      });

      await act(async () => {
        await result.current.checkAndActivate();
      });

      expect(result.current.qrActivationStatus).toBe('waiting');
    });
  });

  describe('pure helpers', () => {
    it('formatCountdown renders mm:ss with zero-padded seconds', () => {
      const { result } = renderHook(() => useQrPayment(baseParams()));
      expect(result.current.formatCountdown(240)).toBe('4:00');
      expect(result.current.formatCountdown(125)).toBe('2:05');
      expect(result.current.formatCountdown(9)).toBe('0:09');
    });

    it('buildEip681Uri returns the EIP-681 transfer URI with the micro amount', async () => {
      const { result } = renderHook(() => useQrPayment(baseParams()));
      await act(async () => {
        await result.current.createContract();
      });
      expect(result.current.buildEip681Uri()).toBe(
        'ethereum:0xToken@8453/transfer?address=0xEscrow&uint256=10000000'
      );
    });

    it('buildEip681Uri returns empty string before an address exists', () => {
      const { result } = renderHook(() => useQrPayment(baseParams()));
      expect(result.current.buildEip681Uri()).toBe('');
    });
  });

  describe('cleanup', () => {
    it('clears the polling and countdown intervals on unmount (no stray timers)', async () => {
      const clearSpy = jest.spyOn(global, 'clearInterval');
      const { result, unmount } = renderHook(() => useQrPayment(baseParams()));
      await act(async () => {
        await result.current.createContract();
      });
      unmount();
      expect(clearSpy).toHaveBeenCalled();
      clearSpy.mockRestore();
    });
  });
});
