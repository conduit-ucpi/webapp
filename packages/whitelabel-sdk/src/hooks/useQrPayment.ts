import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * QR-payment subsystem shared by contract-create and contract-pay.
 *
 * Owns the balance polling, the activation round-trip to
 * /api/chain/check-and-activate, and the EIP-681 URI helper. The page-specific differences are
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
 * paid" button and the balance poll's automatic sweep) get that gate.
 */
export type QrActivationStatus = 'idle' | 'checking' | 'success' | 'waiting';

/** Poll every `everyMs` until `untilMs` after the run started. */
interface PollPhase {
  untilMs: number;
  everyMs: number;
}

/**
 * How often to look for the payment. Briskly while the payer is most likely mid-transfer,
 * tapering off, then not at all: after seven minutes the page waits for "I have paid".
 */
const INITIAL_POLL_SCHEDULE: readonly PollPhase[] = [
  { untilMs: 2 * 60_000, everyMs: 10_000 },
  { untilMs: 5 * 60_000, everyMs: 20_000 },
  { untilMs: 7 * 60_000, everyMs: 30_000 },
];

/**
 * After "I have paid" finds nothing yet. The payer has just said the money is on its way, so
 * keep looking for a couple of minutes — a transfer can be sent but not yet confirmed.
 */
const AFTER_PRESS_POLL_SCHEDULE: readonly PollPhase[] = [{ untilMs: 2 * 60_000, everyMs: 20_000 }];

/** The wait before the next poll, or null when the schedule has run out. */
function nextPollDelay(schedule: readonly PollPhase[], elapsedMs: number): number | null {
  const phase = schedule.find((p) => elapsedMs + p.everyMs <= p.untilMs);
  return phase ? phase.everyMs : null;
}

interface PollRun {
  schedule: readonly PollPhase[];
  /** Read straight away. False after a button press, which has only just read. */
  pollFirst: boolean;
}

/**
 * Which backend call turns a funded address live, and what to send it.
 *
 * Defaults to the escrow's `checkAndActivate`. The marketplace overrides it with
 * `fund-offer` on an OfferVault, because the two flows are the same shape: money arrives by
 * direct transfer, and a permissionless call then observes the balance and flips the state.
 * Everything else in this hook — the balance poll, the "I have paid" gate —
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
  qrPaymentDetected: boolean;
  qrActivationStatus: QrActivationStatus;
  isCreatingContract: boolean;
  /**
   * False until the first balance read for the current escrow has resolved.
   *
   * Callers should hold the panel back until this is true: an escrow that was
   * already funded sweeps itself the moment that read lands, so rendering
   * beforehand shows a payment screen for a payment that is about to complete
   * on its own.
   */
  hasCheckedBalance: boolean;
  /** Resolves the escrow address and also returns it, for callers that need to
   *  act on it immediately rather than wait for the state update. */
  createContract: () => Promise<string | undefined>;
  /** The "I have paid" button: checks now, and if nothing has arrived yet, polls every 20s
   *  for two minutes. */
  checkAndActivate: () => Promise<void>;
  buildEip681Uri: () => string;
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
  const [qrPaymentDetected, setQrPaymentDetected] = useState(false);
  const [qrActivationStatus, setQrActivationStatus] = useState<QrActivationStatus>('idle');
  const [hasCheckedBalance, setHasCheckedBalance] = useState(false);
  const [isCreatingContract, setIsCreatingContract] = useState(false);
  const [pollRun, setPollRun] = useState<PollRun>({ schedule: INITIAL_POLL_SCHEDULE, pollFirst: true });
  const qrPollingRef = useRef<NodeJS.Timeout | null>(null);

  // getTokenBalance comes from useSimpleEthers, which returns a fresh object
  // each render. Held in a ref so activate below does not have to take
  // it as a dependency and change identity every render.
  const getTokenBalanceRef = useRef(getTokenBalance);
  useEffect(() => {
    getTokenBalanceRef.current = getTokenBalance;
  });

  // Same treatment, same reason: callers pass this as an object literal, so a fresh identity
  // every render would make activate unstable.
  const activationRef = useRef(activation);

  // Held in a ref for the same reason as getTokenBalance: naming it as a
  // dependency of the polling effect would rebuild the interval every render.
  const activateRef = useRef<() => Promise<boolean>>(async () => false);

  // Fires the sweep at most once per mounted verification, so a poll that keeps
  // seeing the same funded balance does not resubmit while the first is in flight.
  const autoActivatedRef = useRef(false);
  useEffect(() => {
    activationRef.current = activation;
  });

  /** Resolves true once the backend has activated the escrow. */
  const activate = useCallback(async (): Promise<boolean> => {
    if (!qrContractAddress || !authenticatedFetch) return false;

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
        return false;
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
        if (qrPollingRef.current) clearTimeout(qrPollingRef.current);
        onActivated(qrContractAddress);
        return true;
      }
      setQrActivationStatus('waiting');
      return false;
    } catch (error) {
      console.error(`useQrPayment: ${activationRef.current.endpoint} failed:`, error);
      setQrActivationStatus('waiting');
      return false;
    }
  }, [qrContractAddress, authenticatedFetch, selectedTokenAddress, requiredAmount, onActivated]);

  // Keep the ref pointing at the current closure without making the polling
  // effect depend on it.
  useEffect(() => {
    activateRef.current = activate;
  }, [activate]);

  // A fresh object every press, so pressing again restarts the two minutes.
  const checkAndActivate = useCallback(async () => {
    if (await activate()) return;
    setPollRun({ schedule: AFTER_PRESS_POLL_SCHEDULE, pollFirst: false });
  }, [activate]);

  // Returns the resolved escrow address as well as storing it, so a caller that
  // needs to act on it immediately — signing a transfer to it from the
  // connected wallet — does not have to wait for the state round-trip.
  const createContract = useCallback(async (): Promise<string | undefined> => {
    setIsCreatingContract(true);
    try {
      const resolved = await createContractImpl();
      if (resolved) {
        setQrContractAddress(resolved);
      }
      return resolved;
    } finally {
      setIsCreatingContract(false);
    }
  }, [createContractImpl]);

  // Hold the panel back until the first read for this escrow lands. Its own effect, so that a
  // button press restarting the poll below does not put the spinner back.
  useEffect(() => {
    setHasCheckedBalance(false);
  }, [qrContractAddress, selectedTokenAddress, requiredAmount]);

  /*
   * Balance polling, on the current run's schedule (INITIAL_POLL_SCHEDULE, or
   * AFTER_PRESS_POLL_SCHEDULE once "I have paid" has found nothing), then stop.
   *
   * ⚠️ THE ACTIVATION STATUS IS NOT A DEPENDENCY, only whether it has succeeded. Every status
   *    change used to restart this effect, and each restart reset hasCheckedBalance — which the
   *    panel reads as "hide everything behind a spinner". A hidden 4-minute countdown then
   *    re-fired checkAndActivate on every tick once it reached zero (each status change rebuilt
   *    it at 0), so after four minutes the QR code and the spinner swapped places every second
   *    for as long as the page was open. The countdown is gone: this poll already sweeps the
   *    moment the money lands, which is all the countdown was ever for.
   */
  const isActivated = qrActivationStatus === 'success';
  useEffect(() => {
    if (!qrContractAddress || !selectedTokenAddress || isActivated) return;

    let cancelled = false;
    const startedAt = Date.now();

    const scheduleNext = () => {
      if (cancelled) return;
      const delay = nextPollDelay(pollRun.schedule, Date.now() - startedAt);
      if (delay !== null) qrPollingRef.current = setTimeout(pollBalance, delay);
    };

    const pollBalance = async () => {
      try {
        const balance = await getTokenBalance(qrContractAddress, selectedTokenAddress);
        const balanceNum = parseFloat(balance);

        if (balanceNum >= requiredAmount && requiredAmount > 0) {
          console.log('useQrPayment: QR payment detected! Balance:', balance);
          setQrPaymentDetected(true);

          // The money is already in the escrow, so the only step left is the
          // sweep. Run it rather than asking the payer to confirm something the
          // chain has already told us — this is the case where someone arrives
          // at a contract funded on an earlier visit and would otherwise have to
          // press a button to claim funds they had already sent.
          //
          // activate re-reads the balance before spending any gas, so
          // there is no risk in calling it on the strength of this poll.
          if (!autoActivatedRef.current) {
            autoActivatedRef.current = true;
            void activateRef.current();
          }
        }
      } catch (error) {
        console.error('useQrPayment: Failed to poll contract balance:', error);
      } finally {
        // Resolved either way: an unreadable balance must not hold the panel
        // back forever, it just means we cannot skip it.
        setHasCheckedBalance(true);
        scheduleNext();
      }
    };

    if (pollRun.pollFirst) pollBalance();
    else scheduleNext();

    return () => {
      cancelled = true;
      if (qrPollingRef.current) clearTimeout(qrPollingRef.current);
    };
    // NOTE: getTokenBalance is intentionally NOT a dependency. useSimpleEthers
    // returns a fresh object each render, so including it re-creates the
    // polling interval (and immediately re-polls) on every render — a loop.
    // The primitive deps capture every input that should restart polling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrContractAddress, selectedTokenAddress, requiredAmount, isActivated, pollRun]);

  const buildEip681Uri = useCallback((): string => {
    if (!qrContractAddress || !selectedTokenAddress || chainId === undefined) return '';
    return `ethereum:${selectedTokenAddress}@${chainId}/transfer?address=${qrContractAddress}&uint256=${requiredAmountMicro}`;
  }, [qrContractAddress, selectedTokenAddress, chainId, requiredAmountMicro]);

  return {
    qrContractAddress,
    qrPaymentDetected,
    qrActivationStatus,
    isCreatingContract,
    hasCheckedBalance,
    createContract,
    checkAndActivate,
    buildEip681Uri,
  };
}
