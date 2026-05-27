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
 * Behavior is a verbatim extraction of the prior inline implementation in both
 * pages; nothing about the timing, polling cadence, or status transitions
 * changed.
 */
export type QrActivationStatus = 'idle' | 'checking' | 'success' | 'waiting';

const COUNTDOWN_SECONDS = 240;
const POLL_INTERVAL_MS = 10_000;

interface UseQrPaymentParams {
  authenticatedFetch: ((url: string, init?: RequestInit) => Promise<Response>) | undefined;
  getTokenBalance: (address: string, tokenAddress: string) => Promise<string>;
  selectedTokenAddress: string | undefined;
  chainId: number | undefined;
  requiredAmount: number;
  requiredAmountMicro: number;
  createContract: () => Promise<string | undefined>;
  onActivated: (contractAddress: string) => void;
}

interface UseQrPaymentResult {
  qrContractAddress: string | null;
  qrCountdown: number;
  qrPaymentDetected: boolean;
  qrActivationStatus: QrActivationStatus;
  isCreatingContract: boolean;
  createContract: () => Promise<void>;
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
  } = params;

  const [qrContractAddress, setQrContractAddress] = useState<string | null>(null);
  const [qrCountdown, setQrCountdown] = useState(COUNTDOWN_SECONDS);
  const [qrPaymentDetected, setQrPaymentDetected] = useState(false);
  const [qrActivationStatus, setQrActivationStatus] = useState<QrActivationStatus>('idle');
  const [isCreatingContract, setIsCreatingContract] = useState(false);
  const qrPollingRef = useRef<NodeJS.Timeout | null>(null);
  const qrCountdownRef = useRef<NodeJS.Timeout | null>(null);

  const checkAndActivate = useCallback(async () => {
    if (!qrContractAddress || !authenticatedFetch) return;

    setQrActivationStatus('checking');

    try {
      const response = await authenticatedFetch('/api/chain/check-and-activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractAddress: qrContractAddress }),
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
      console.error('useQrPayment: check-and-activate failed:', error);
      setQrActivationStatus('waiting');
    }
  }, [qrContractAddress, authenticatedFetch, onActivated]);

  const createContract = useCallback(async () => {
    setIsCreatingContract(true);
    try {
      const resolved = await createContractImpl();
      if (resolved) {
        setQrContractAddress(resolved);
        setQrCountdown(COUNTDOWN_SECONDS);
      }
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
