/**
 * TDD spec for useQrPayment — the QR-payment subsystem extracted (verbatim in
 * behavior) from contract-create.tsx and contract-pay.tsx.
 *
 * Written BEFORE the hook exists. These tests define the contract:
 *  - balance polling every 10s for 2 min, 20s to 5 min, 30s to 7 min, then
 *    stops; "I have paid" finding nothing polls every 20s for 2 min. Sets
 *    paymentDetected when balance >= required and sweeps once
 *  - checkAndActivate POSTs /api/chain/check-and-activate and drives status,
 *    invoking the page-specific onActivated callback on success
 *  - createContract delegates to the page-supplied creator and stores the address
 *  - buildEip681Uri pure helper
 *  - timers are cleared on unmount and on success (no leaks)
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
    it('starts idle with no contract address', () => {
      const { result } = renderHook(() => useQrPayment(baseParams()));
      expect(result.current.qrContractAddress).toBeNull();
      expect(result.current.qrActivationStatus).toBe('idle');
      expect(result.current.qrPaymentDetected).toBe(false);
      expect(result.current.isCreatingContract).toBe(false);
    });
  });

  describe('createContract', () => {
    it('delegates to the supplied creator and stores the resolved address', async () => {
      const { result } = renderHook(() => useQrPayment(baseParams()));

      await act(async () => {
        await result.current.createContract();
      });

      expect(mockCreateContract).toHaveBeenCalledTimes(1);
      expect(result.current.qrContractAddress).toBe('0xEscrow');
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

  describe('polling cadence', () => {
    const advance = async (ms: number) => {
      await act(async () => {
        await jest.advanceTimersByTimeAsync(ms);
      });
    };

    /** Balance reads made in each window of `ms`, advancing through them in turn. */
    const readsPer = async (...windows: number[]) => {
      const counts: number[] = [];
      for (const ms of windows) {
        const before = mockGetTokenBalance.mock.calls.length;
        await advance(ms);
        counts.push(mockGetTokenBalance.mock.calls.length - before);
      }
      return counts;
    };

    it('reads at once, then every 10s to 2 min, every 20s to 5 min, every 30s to 7 min, then stops', async () => {
      const { result } = renderHook(() => useQrPayment(baseParams()));
      await act(async () => {
        await result.current.createContract();
      });
      await advance(0);
      expect(mockGetTokenBalance).toHaveBeenCalledTimes(1);

      const [first2, next3, next2, after] = await readsPer(120_000, 180_000, 120_000, 30 * 60_000);
      expect(first2).toBe(12); // 0:10 … 2:00
      expect(next3).toBe(9); // 2:20 … 5:00
      expect(next2).toBe(4); // 5:30 … 7:00
      expect(after).toBe(0);
    });

    it('after "I have paid" finds nothing, reads every 20s for 2 min, then stops again', async () => {
      const { result } = renderHook(() => useQrPayment(baseParams()));
      await act(async () => {
        await result.current.createContract();
      });
      await advance(10 * 60_000); // the initial schedule has run out

      const before = mockGetTokenBalance.mock.calls.length;
      await act(async () => {
        await result.current.checkAndActivate();
      });
      expect(mockGetTokenBalance).toHaveBeenCalledTimes(before + 1); // the press's own read

      const [first19s, rest, after] = await readsPer(19_000, 101_000, 30 * 60_000);
      expect(first19s).toBe(0);
      expect(rest).toBe(6); // 0:20 … 2:00
      expect(after).toBe(0);
    });

    it('pressing again restarts the two minutes', async () => {
      const { result } = renderHook(() => useQrPayment(baseParams()));
      await act(async () => {
        await result.current.createContract();
      });
      await advance(10 * 60_000);

      await act(async () => {
        await result.current.checkAndActivate();
      });
      await advance(100_000);
      await act(async () => {
        await result.current.checkAndActivate();
      });

      const [nextTwoMin] = await readsPer(120_000);
      expect(nextTwoMin).toBe(6);
    });

    it('still sweeps when the money lands during the post-press polling', async () => {
      mockAuthenticatedFetch.mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
      const { result } = renderHook(() => useQrPayment(baseParams()));
      await act(async () => {
        await result.current.createContract();
      });
      await advance(10 * 60_000);
      await act(async () => {
        await result.current.checkAndActivate();
      });
      expect(mockAuthenticatedFetch).not.toHaveBeenCalled();

      mockGetTokenBalance.mockResolvedValue('10');
      await advance(20_000);

      expect(result.current.qrActivationStatus).toBe('success');
      expect(mockOnActivated).toHaveBeenCalledWith('0xEscrow');
    });

    /*
     * Regression: a hidden 4-minute countdown re-fired checkAndActivate every second once it hit
     * zero, and every status change restarted polling and reset hasCheckedBalance — so the panel
     * swapped the QR code for a spinner every second for as long as the page stayed open.
     */
    it('never hides the panel again once the first read has landed, however long it waits', async () => {
      const seen: boolean[] = [];
      const { result } = renderHook(() => {
        const qr = useQrPayment(baseParams());
        seen.push(qr.hasCheckedBalance);
        return qr;
      });
      await act(async () => {
        await result.current.createContract();
      });
      await advance(0);
      expect(result.current.hasCheckedBalance).toBe(true);
      const firstChecked = seen.lastIndexOf(false) + 1;

      await advance(10 * 60_000);

      expect(seen.slice(firstChecked)).not.toContain(false);
      // Nothing fires on its own against an unfunded escrow; only the button checks on demand.
      expect(result.current.qrActivationStatus).toBe('idle');
    });

    it('keeps its cadence when the user presses "I have paid" and nothing has arrived', async () => {
      const { result } = renderHook(() => useQrPayment(baseParams()));
      await act(async () => {
        await result.current.createContract();
      });
      await advance(0);
      const before = mockGetTokenBalance.mock.calls.length;

      await act(async () => {
        await result.current.checkAndActivate();
      });
      await advance(5_000);

      expect(result.current.qrActivationStatus).toBe('waiting');
      expect(result.current.hasCheckedBalance).toBe(true);
      // The button's own read and nothing more. A status change used to restart the poll,
      // which read again straight away and reset hasCheckedBalance on the way.
      expect(mockGetTokenBalance).toHaveBeenCalledTimes(before + 1);
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

    it('reports the balance unchecked until the first read lands', async () => {
      // The panel holds itself back on this, so that an escrow which is about to
      // sweep itself never flashes a payment screen at the user.
      let resolveBalance: (v: string) => void = () => {};
      mockGetTokenBalance.mockReturnValue(new Promise<string>((r) => { resolveBalance = r; }));

      const { result } = renderHook(() => useQrPayment(baseParams()));
      await act(async () => {
        await result.current.createContract();
      });

      expect(result.current.hasCheckedBalance).toBe(false);

      await act(async () => {
        resolveBalance('0');
        await Promise.resolve();
      });

      await waitFor(() => expect(result.current.hasCheckedBalance).toBe(true));
    });

    it('reports the balance checked even when the read fails', async () => {
      // An unreadable balance must not hold the panel back forever — it only
      // means we cannot skip showing it.
      mockGetTokenBalance.mockRejectedValue(new Error('rpc down'));

      const { result } = renderHook(() => useQrPayment(baseParams()));
      await act(async () => {
        await result.current.createContract();
      });
      await act(async () => {
        await Promise.resolve();
      });

      await waitFor(() => expect(result.current.hasCheckedBalance).toBe(true));
    });

    it('sweeps automatically when the escrow is already funded on arrival', async () => {
      // Someone returning to a contract they funded earlier should not have to
      // press a button to claim money the chain already shows is theirs.
      mockGetTokenBalance.mockResolvedValue('10');
      mockAuthenticatedFetch.mockResolvedValue({ ok: true, json: async () => ({ success: true }) });

      const { result } = renderHook(() => useQrPayment(baseParams()));
      await act(async () => {
        await result.current.createContract();
      });
      await act(async () => {
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(mockAuthenticatedFetch).toHaveBeenCalledWith(
          '/api/chain/check-and-activate',
          expect.objectContaining({ method: 'POST' })
        );
      });
    });

    it('does not sweep repeatedly while the same funded balance keeps polling', async () => {
      mockGetTokenBalance.mockResolvedValue('10');
      mockAuthenticatedFetch.mockResolvedValue({ ok: true, json: async () => ({ success: true }) });

      const { result } = renderHook(() => useQrPayment(baseParams()));
      await act(async () => {
        await result.current.createContract();
      });
      await act(async () => {
        await Promise.resolve();
      });
      await waitFor(() => expect(mockAuthenticatedFetch).toHaveBeenCalled());

      const callsAfterFirst = mockAuthenticatedFetch.mock.calls.length;
      await act(async () => {
        jest.advanceTimersByTime(30000); // three more poll intervals
        await Promise.resolve();
      });

      // Resubmitting spends gas on a sweep already in flight.
      expect(mockAuthenticatedFetch.mock.calls.length).toBe(callsAfterFirst);
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

  // check-and-activate submits a real on-chain checkAndActivate() transaction,
  // which reverts with InsufficientDirectPayment and still burns platform gas
  // when the escrow is empty. Nothing may reach it unless the escrow is funded.
  describe('gas safety: balance gate in front of activation', () => {
    it('sends nothing when the user presses "I have paid" but no payment arrived', async () => {
      mockGetTokenBalance.mockResolvedValue('0');
      mockAuthenticatedFetch.mockResolvedValue({ json: async () => ({ success: true }) });
      const { result } = renderHook(() => useQrPayment(baseParams()));
      await act(async () => {
        await result.current.createContract();
      });

      await act(async () => {
        await result.current.checkAndActivate();
      });

      expect(mockAuthenticatedFetch).not.toHaveBeenCalled();
      // The user pressed a button, so they still get an answer.
      expect(result.current.qrActivationStatus).toBe('waiting');
      expect(mockOnActivated).not.toHaveBeenCalled();
    });

    it('sends nothing on a partial payment', async () => {
      mockGetTokenBalance.mockResolvedValue('9.99');
      mockAuthenticatedFetch.mockResolvedValue({ json: async () => ({ success: true }) });
      const { result } = renderHook(() => useQrPayment(baseParams()));
      await act(async () => {
        await result.current.createContract();
      });

      await act(async () => {
        await result.current.checkAndActivate();
      });

      expect(mockAuthenticatedFetch).not.toHaveBeenCalled();
    });

    it('sends nothing when the balance cannot be read', async () => {
      mockGetTokenBalance.mockRejectedValue(new Error('rpc down'));
      mockAuthenticatedFetch.mockResolvedValue({ json: async () => ({ success: true }) });
      const { result } = renderHook(() => useQrPayment(baseParams()));
      await act(async () => {
        await result.current.createContract();
      });

      await act(async () => {
        await result.current.checkAndActivate();
      });

      expect(mockAuthenticatedFetch).not.toHaveBeenCalled();
      expect(result.current.qrActivationStatus).toBe('waiting');
    });

    it('sends nothing however long an unfunded escrow waits', async () => {
      mockGetTokenBalance.mockResolvedValue('0');
      mockAuthenticatedFetch.mockResolvedValue({ json: async () => ({ success: true }) });
      const { result } = renderHook(() => useQrPayment(baseParams()));
      await act(async () => {
        await result.current.createContract();
      });

      await act(async () => {
        await jest.advanceTimersByTimeAsync(10 * 60_000);
      });

      expect(mockAuthenticatedFetch).not.toHaveBeenCalled();
    });

    it('sends once the escrow is funded', async () => {
      mockGetTokenBalance.mockResolvedValue('10');
      mockAuthenticatedFetch.mockResolvedValue({ json: async () => ({ success: true }) });
      const { result } = renderHook(() => useQrPayment(baseParams()));
      await act(async () => {
        await result.current.createContract();
      });

      await act(async () => {
        await result.current.checkAndActivate();
      });

      expect(mockAuthenticatedFetch).toHaveBeenCalledWith(
        '/api/chain/check-and-activate',
        expect.objectContaining({ method: 'POST' })
      );
      expect(result.current.qrActivationStatus).toBe('success');
    });
  });

  describe('checkAndActivate', () => {
    // Activation only reaches the backend on a funded escrow; the unfunded
    // paths are covered by the gas-safety block above.
    beforeEach(() => {
      mockGetTokenBalance.mockResolvedValue('10');
    });

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
    it('clears the polling timer on unmount (no stray timers)', async () => {
      const clearSpy = jest.spyOn(global, 'clearTimeout');
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
