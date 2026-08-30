import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * QR-payment subsystem shared by contract-create and contract-pay.
 *
 * Owns the timing machinery (countdown, balance polling), the activation
 * round-trip to /api/chain/check-and-activate, and the QR pure helpers
 * (EIP-681 URI, countdown formatting). The page-specific differences are
 * injected:
 *   - `createContract`   how the on-chain escrow is produced for this page
 *                        (create POSTs /api/chain/create-contract; pay uses
 *                        resolveOrCreateOnChainContract). Returns the resolved
 *                        contract address, or undefined/empty on failure.
 *   - `requiredAmount`   token-unit amount that must arrive before we mark the
 *                        payment detected (create: form amount; pay:
 *                        contract.amount / 1e6).
 *   - `requiredAmountMicro` micro amount embedded in the EIP-681 URI.
 *   - `onActivated`      what to do once the backend confirms activation
 *                        (create: postMessage + WordPress/iframe/popup redirect;
 *                        pay: router.push('/dashboard')).
 *
 * checkAndActivate reads the escrow's token balance before it will spend
 * anything — see the comment on the call itself. Both callers (the "I have
 * paid" button and the countdown auto-fire) get that gate.
 */
export type QrActivationStatus = 'idle' | 'checking' | 'success' | 'waiting';

const COUNTDOWN_SECONDS = 240;
const POLL_INTERVAL_MS = 10_000;

/**
 * Which backend call turns a funded address live, and what to send it.
 *
 * Defaults to the escrow's `checkAndActivate`. The marketplace overrides it with
 * `fund-offer` on an OfferVault, because the two flows are the same shape: money arrives by
 * direct transfer, and a permissionless call then observes the balance and flips the state.
 * Everything else in this hook — the countdown, the balance poll, the "I have paid" gate —
 * is identical for both, and duplicating it is how one of them ends up without the
 * balance-before-gas check below.
 */
interface QrActivationTarget {
  endpoint: string;
  /** The request body, given the address the money was sent to. */
  buildBody: (fundedAddress: string) => Record<string, unknown>;
}

const ESCROW_ACTIVATION: QrActivationTarget = {
  endpoint: '/api/chain/check-and-activate',
  buildBody: (contractAddress) => ({ contractAddress }),
};

interface UseQrPaymentParams {
  authenticatedFetch: ((url: string, init?: RequestInit) => Promise<Response>) | undefined;
  getTokenBalance: (address: string, tokenAddress: string) => Promise<string>;
  selectedTokenAddress: string | undefined;
  chainId: number | undefined;
  requiredAmount: number;
  requiredAmountMicro: number;
  createContract: () => Promise<string | undefined>;
  onActivated: (contractAddress: string) => void;
  /** Omit for the escrow flow. */
  activation?: QrActivationTarget;
  /**
   * An escrow that already exists on chain. Supplied when the payer returns to
   * a request whose contract was deployed on an earlier visit — funds may
   * already be sitting in it, waiting to be swept — so there is nothing to
   * create and the balance poll should start against this address immediately.
   */
  existingContractAddress?: string | null;
}

interface UseQrPaymentResult {
  qrContractAddress: string | null;
  qrCountdown: number;
  qrPaymentDetected: boolean;
  qrActivationStatus: QrActivationStatus;
  isCreatingContract: boolean;
  /** Resolves the escrow address and also returns it, for callers that need to
   *  act on it immediately rather than wait for the state update. */
  createContract: () => Promise<string | undefined>;
  checkAndActivate: () => Promise<void>;
  buildEip681Uri: () => string;
  formatCountdown: (seconds: number) => string;
}

export function useQrPayment(params: UseQrPaymentParams): UseQrPaymentResult {
  const {
    authenticatedFetch,
    getTokenBalance,
    selectedTokenAddress,
    chainId,
    requiredAmount,
    requiredAmountMicro,
    createContract: createContractImpl,
    onActivated,
    activation = ESCROW_ACTIVATION,
    existingContractAddress = null,
  } = params;

  const [qrContractAddress, setQrContractAddress] = useState<string | null>(existingContractAddress);

  // The address arrives with the contract fetch, which resolves after mount.
  useEffect(() => {
    if (!existingContractAddress) return;
    setQrContractAddress((current) => current ?? existingContractAddress);
  }, [existingContractAddress]);
  const [qrCountdown, setQrCountdown] = useState(COUNTDOWN_SECONDS);
  const [qrPaymentDetected, setQrPaymentDetected] = useState(false);
  const [qrActivationStatus, setQrActivationStatus] = useState<QrActivationStatus>('idle');
  const [isCreatingContract, setIsCreatingContract] = useState(false);
  const qrPollingRef = useRef<NodeJS.Timeout | null>(null);
  const qrCountdownRef = useRef<NodeJS.Timeout | null>(null);

  // getTokenBalance comes from useSimpleEthers, which returns a fresh object
  // each render. Held in a ref so checkAndActivate below does not have to take
  // it as a dependency — checkAndActivate is itself a dependency of the
  // countdown effect, which would then re-create its interval every render.
  const getTokenBalanceRef = useRef(getTokenBalance);
  useEffect(() => {
    getTokenBalanceRef.current = getTokenBalance;
  });

  // Same treatment, same reason: callers pass this as an object literal, so a fresh identity
  // every render would make checkAndActivate unstable — and checkAndActivate is a dependency
  // of the countdown effect below, which would then re-create its interval on every render.
  const activationRef = useRef(activation);
  useEffect(() => {
    activationRef.current = activation;
  });

  const checkAndActivate = useCallback(async () => {
    if (!qrContractAddress || !authenticatedFetch) return;

    setQrActivationStatus('checking');

    try {
      // The activation endpoint is NOT a read. chainservice signs and submits an on-chain
      // call — checkAndActivate() on an escrow, fund() on an OfferVault — and BOTH revert
      // with InsufficientDirectPayment when the money has not arrived, burning gas on the
      // reverting transaction (gas estimation fails, but chainservice falls back to a
      // configured limit and sends anyway). balanceOf is free, so confirm the money is
      // actually there first. This gate is the reason both flows share this hook.
      const funded = await (async () => {
        if (!selectedTokenAddress || requiredAmount <= 0) return false;
        try {
          const balance = await getTokenBalanceRef.current(qrContractAddress, selectedTokenAddress);
          return parseFloat(balance) >= requiredAmount;
        } catch (error) {
          // An unreadable balance is not permission to spend gas on a guess.
          console.error('useQrPayment: balance read before activation failed:', error);
          return false;
        }
      })();

      if (!funded) {
        setQrActivationStatus('waiting');
        return;
      }

      const target = activationRef.current;
      const response = await authenticatedFetch(target.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(target.buildBody(qrContractAddress)),
      });

      const data = await response.json();

      if (data.success) {
        setQrActivationStatus('success');
        if (qrPollingRef.current) clearInterval(qrPollingRef.current);
        if (qrCountdownRef.current) clearInterval(qrCountdownRef.current);
        onActivated(qrContractAddress);
      } else {
        setQrActivationStatus('waiting');
      }
    } catch (error) {
      console.error(`useQrPayment: ${activationRef.current.endpoint} failed:`, error);
      setQrActivationStatus('waiting');
    }
  }, [qrContractAddress, authenticatedFetch, selectedTokenAddress, requiredAmount, onActivated]);

  // Returns the resolved escrow address as well as storing it, so a caller that
  // needs to act on it immediately — signing a transfer to it from the
  // connected wallet — does not have to wait for the state round-trip.
  const createContract = useCallback(async (): Promise<string | undefined> => {
    setIsCreatingContract(true);
    try {
      const resolved = await createContractImpl();
      if (resolved) {
        setQrContractAddress(resolved);
        setQrCountdown(COUNTDOWN_SECONDS);
      }
      return resolved;
    } finally {
      setIsCreatingContract(false);
    }
  }, [createContractImpl]);

  // Cleanup polling/countdown on unmount.
  useEffect(() => {
    return () => {
      if (qrPollingRef.current) clearInterval(qrPollingRef.current);
      if (qrCountdownRef.current) clearInterval(qrCountdownRef.current);
    };
  }, []);

  // Countdown timer: ticks once per second; auto-fires activation at zero.
  useEffect(() => {
    if (!qrContractAddress || qrActivationStatus === 'success') return;

    qrCountdownRef.current = setInterval(() => {
      setQrCountdown((prev) => {
        if (prev <= 1) {
          if (qrCountdownRef.current) clearInterval(qrCountdownRef.current);
          checkAndActivate();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (qrCountdownRef.current) clearInterval(qrCountdownRef.current);
    };
  }, [qrContractAddress, qrActivationStatus, checkAndActivate]);

  // Balance polling: every 10s (and immediately), flag payment once funded.
  useEffect(() => {
    if (!qrContractAddress || !selectedTokenAddress || qrActivationStatus === 'success') return;

    const pollBalance = async () => {
      try {
        const balance = await getTokenBalance(qrContractAddress, selectedTokenAddress);
        const balanceNum = parseFloat(balance);

        if (balanceNum >= requiredAmount && requiredAmount > 0) {
          console.log('useQrPayment: QR payment detected! Balance:', balance);
          setQrPaymentDetected(true);
        }
      } catch (error) {
        console.error('useQrPayment: Failed to poll contract balance:', error);
      }
    };

    qrPollingRef.current = setInterval(pollBalance, POLL_INTERVAL_MS);
    pollBalance();

    return () => {
      if (qrPollingRef.current) clearInterval(qrPollingRef.current);
    };
    // NOTE: getTokenBalance is intentionally NOT a dependency. useSimpleEthers
    // returns a fresh object each render, so including it re-creates the
    // polling interval (and immediately re-polls) on every render — a loop.
    // The primitive deps capture every input that should restart polling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrContractAddress, selectedTokenAddress, requiredAmount, qrActivationStatus]);

  const buildEip681Uri = useCallback((): string => {
    if (!qrContractAddress || !selectedTokenAddress || chainId === undefined) return '';
    return `ethereum:${selectedTokenAddress}@${chainId}/transfer?address=${qrContractAddress}&uint256=${requiredAmountMicro}`;
  }, [qrContractAddress, selectedTokenAddress, chainId, requiredAmountMicro]);

  const formatCountdown = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  return {
    qrContractAddress,
    qrCountdown,
    qrPaymentDetected,
    qrActivationStatus,
    isCreatingContract,
    createContract,
    checkAndActivate,
    buildEip681Uri,
    formatCountdown,
  };
}
