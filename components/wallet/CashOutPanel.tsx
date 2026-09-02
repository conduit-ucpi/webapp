import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { ethers } from 'ethers';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import ExpandableHash from '@/components/ui/ExpandableHash';
import { useConfig } from '@/components/auth/ConfigProvider';
import { useSimpleEthers } from '@/hooks/useSimpleEthers';
import { OFFRAMP_RETURN_MESSAGE, openCoinbaseOfframp } from '@/lib/coinbaseOfframp';

/**
 * Cash out to a bank account, via Coinbase.
 *
 * The flow is a handshake, not a single hop, and that shapes this whole
 * component. Coinbase's widget only CREATES a sell order — it never pulls the
 * crypto. We then read the order back, learn the Coinbase-managed address, and
 * send the tokens ourselves inside a 30 minute window. Two states, therefore:
 * start an order, and settle one.
 */

/** How we know the user has just come back from Coinbase rather than reloading. */
const RETURN_QUERY_KEY = 'cashout';
const RETURN_QUERY_VALUE = 'return';

/** The order is not on Coinbase's side the instant they redirect us back. */
const POLL_INTERVAL_MS = 2000;
const POLL_ATTEMPTS = 15;

interface PendingOrder {
  transactionId: string;
  toAddress: string;
  asset: string;
  network: string;
  amount: string;
  currency: string;
  createdAt: string;
  expiresAt: string;
}

interface CashOutPanelProps {
  walletAddress: string;
  /** Token balances keyed by symbol, as /wallet already loaded them. */
  balances: Record<string, string>;
  /** Called after a successful send so the page can refresh balances. */
  onSent?: () => void;
}

function formatTimeLeft(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

export default function CashOutPanel({ walletAddress, balances, onSent }: CashOutPanelProps) {
  const router = useRouter();
  const { config } = useConfig();
  const { fundAndSendTransaction } = useSimpleEthers();

  // Memoised because the fallback literal would otherwise be a new array every
  // render, churning the identity of everything downstream of it — including the
  // callback the message listener effect depends on.
  const supportedTokens = useMemo(() => config?.supportedTokens || [], [config?.supportedTokens]);
  const defaultSymbol = config?.defaultToken?.symbol || config?.defaultTokenSymbol || '';

  const [symbol, setSymbol] = useState(defaultSymbol);
  const [amount, setAmount] = useState('');
  const [isOpening, setIsOpening] = useState(false);
  const [isWaitingForOrder, setIsWaitingForOrder] = useState(false);
  const [pending, setPending] = useState<PendingOrder | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTxHash, setSentTxHash] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Orders we have already raised a signature prompt for. Auto-firing is armed
  // once per order so a rejected prompt does not immediately re-appear, and a
  // re-poll that returns the same order does not prompt twice.
  const autoSentRef = useRef<Set<string>>(new Set());
  const pollTimerRef = useRef<number | null>(null);

  const isConfigured = !!config?.coinbaseProjectId && !!config?.coinbaseNetwork;

  useEffect(() => {
    if (!symbol && defaultSymbol) setSymbol(defaultSymbol);
  }, [defaultSymbol, symbol]);

  const selectedToken = supportedTokens.find(t => t.symbol === symbol);
  const availableBalance = parseFloat(balances[symbol] || '0');

  const fetchPending = useCallback(async (): Promise<PendingOrder | null> => {
    const response = await fetch('/api/coinbase/offramp/pending', { credentials: 'include' });
    if (!response.ok) return null;
    const data = await response.json().catch(() => ({}));
    return (data?.pending as PendingOrder | undefined) || null;
  }, []);

  /**
   * Everything that has to be true before we move a user's money.
   *
   * The order comes back from Coinbase, so its chain and asset are not ours to
   * assume. A sell order on a chain we are not on, or in a token we do not know,
   * is a bug somewhere upstream — the correct response is to refuse and say so,
   * not to sign it through and hope.
   */
  const validateOrder = useCallback(
    (order: PendingOrder): string | null => {
      if (!config?.coinbaseNetwork) return 'Cash-out is not configured on this server.';

      if (order.network.toLowerCase() !== config.coinbaseNetwork.toLowerCase()) {
        return `This cash-out is for ${order.network}, but this wallet is on ${config.coinbaseNetwork}. Nothing has been sent.`;
      }

      const token = supportedTokens.find(t => t.symbol === order.currency);
      if (!token) {
        return `This cash-out is in ${order.currency}, which this wallet does not hold. Nothing has been sent.`;
      }

      if (!/^0x[a-fA-F0-9]{40}$/.test(order.toAddress)) {
        return 'Coinbase returned an address we could not read. Nothing has been sent.';
      }

      return null;
    },
    [config?.coinbaseNetwork, supportedTokens]
  );

  const sendToCoinbase = useCallback(
    async (order: PendingOrder) => {
      const problem = validateOrder(order);
      if (problem) {
        setError(problem);
        return;
      }

      const token = supportedTokens.find(t => t.symbol === order.currency)!;

      setError(null);
      setIsSending(true);
      autoSentRef.current.add(order.transactionId);

      try {
        // Same ERC20 transfer the Send Funds form makes, with the gas sponsored by
        // fundAndSendTransaction so the user needs no native balance to cash out.
        const erc20 = new ethers.Interface([
          'function transfer(address to, uint256 amount) returns (bool)',
        ]);
        const data = erc20.encodeFunctionData('transfer', [
          order.toAddress,
          ethers.parseUnits(order.amount, token.decimals),
        ]);

        const txHash = await fundAndSendTransaction({ to: token.address, data, value: '0' });

        setSentTxHash(txHash);
        setPending(null);
        setAmount('');
        onSent?.();
      } catch (e: any) {
        setError(e?.message || 'The transfer to Coinbase failed');
      } finally {
        setIsSending(false);
      }
    },
    [fundAndSendTransaction, onSent, supportedTokens, validateOrder]
  );

  // fundAndSendTransaction comes from useSimpleEthers, which hands back a fresh
  // object every render, so sendToCoinbase's identity churns. Reading it through
  // a ref keeps pollForOrder stable — otherwise the message listener below would
  // detach and re-attach on every single render.
  const sendRef = useRef(sendToCoinbase);
  useEffect(() => {
    sendRef.current = sendToCoinbase;
  }, [sendToCoinbase]);

  /**
   * Poll until Coinbase has registered the order, then raise the prompt.
   *
   * Only used on the path back from the widget. `autoSend` is what separates
   * "they just confirmed a cash-out and expect to sign" from "we found an old
   * order on page load", where an unheralded wallet prompt would read as an
   * ambush.
   */
  const pollForOrder = useCallback(
    (autoSend: boolean) => {
      let attempts = 0;
      setIsWaitingForOrder(true);

      const tick = async () => {
        attempts += 1;
        const order = await fetchPending().catch(() => null);

        if (order) {
          setIsWaitingForOrder(false);
          setPending(order);
          if (autoSend && !autoSentRef.current.has(order.transactionId)) {
            await sendRef.current(order);
          }
          return;
        }

        if (attempts >= POLL_ATTEMPTS) {
          setIsWaitingForOrder(false);
          return;
        }

        pollTimerRef.current = window.setTimeout(tick, POLL_INTERVAL_MS);
      };

      void tick();
    },
    [fetchPending]
  );

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) window.clearTimeout(pollTimerRef.current);
    };
  }, []);

  // Cold load: surface an order the user abandoned, but wait for them to ask.
  // Mobile sends the whole tab to Coinbase and back, so the return marker on the
  // URL is the only way to tell that case apart from a plain page load.
  useEffect(() => {
    if (!isConfigured || !router.isReady) return;

    const justReturned = router.query[RETURN_QUERY_KEY] === RETURN_QUERY_VALUE;

    if (justReturned) {
      // Strip the marker so a later refresh is treated as the cold load it is.
      const { [RETURN_QUERY_KEY]: _consumed, ...rest } = router.query;
      void router.replace({ pathname: router.pathname, query: rest }, undefined, { shallow: true });
      pollForOrder(true);
      return;
    }

    void fetchPending()
      .then(order => {
        if (order) setPending(order);
      })
      .catch(() => {
        // A failed check is not worth an error banner: the user has not asked for
        // anything yet, and the panel still works for starting a new cash-out.
      });
    // Runs once the router is ready; pollForOrder/fetchPending are stable enough
    // that re-running on their identity would re-poll on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConfigured, router.isReady]);

  // Desktop popup: the return page tells us Coinbase is done.
  useEffect(() => {
    if (!isConfigured) return;

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== OFFRAMP_RETURN_MESSAGE) return;
      setIsOpening(false);
      pollForOrder(true);
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [isConfigured, pollForOrder]);

  // Drives the countdown, and clears an order once its window has closed.
  useEffect(() => {
    if (!pending) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [pending]);

  const msLeft = pending ? Date.parse(pending.expiresAt) - now : 0;

  useEffect(() => {
    if (pending && msLeft <= 0 && !isSending) {
      setPending(null);
      setError('That cash-out expired before it was sent. Nothing left your wallet — start again.');
    }
  }, [pending, msLeft, isSending]);

  const handleStart = async () => {
    if (!config?.coinbaseNetwork || !selectedToken) return;

    setError(null);
    setSentTxHash(null);
    setIsOpening(true);

    try {
      await openCoinbaseOfframp({
        walletAddress,
        asset: selectedToken.symbol,
        network: config.coinbaseNetwork,
        presetCryptoAmount: parseFloat(amount),
        // Carries the marker that tells the mobile round-trip apart from a reload.
        returnPath: `/wallet?${RETURN_QUERY_KEY}=${RETURN_QUERY_VALUE}`,
      });
    } catch (e: any) {
      setError(e?.message || 'Could not open Coinbase');
      setIsOpening(false);
    }
  };

  if (!isConfigured || supportedTokens.length === 0) return null;

  const amountValue = parseFloat(amount);
  const amountIsValid = !isNaN(amountValue) && amountValue > 0 && amountValue <= availableBalance;
  const canStart = !!selectedToken && amountIsValid && !isOpening && !pending;

  return (
    <div className="bg-white dark:bg-secondary-900 rounded-lg shadow-sm dark:shadow-none border border-secondary-200 dark:border-secondary-700 p-6 mb-8">
      <h2 className="text-lg font-semibold text-secondary-900 dark:text-white">Cash out to your bank</h2>
      <p className="mt-1 text-sm text-secondary-600 dark:text-secondary-300">
        Sell your tokens through Coinbase and have the money paid out to your bank account or card.
      </p>

      {pending ? (
        <div className="mt-6 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4">
          <p className="font-semibold text-secondary-900 dark:text-white">
            {isSending ? 'Confirm the transfer in your wallet' : 'Finish your cash-out'}
          </p>
          <p className="mt-1 text-sm text-secondary-700 dark:text-secondary-200">
            Coinbase is waiting for{' '}
            <span className="font-semibold">
              {pending.amount} {pending.currency}
            </span>
            . Sending it completes the cash-out — {formatTimeLeft(msLeft)} left.
          </p>

          <div className="mt-3 text-sm text-secondary-600 dark:text-secondary-300">
            <span className="mr-2">To Coinbase at</span>
            <ExpandableHash hash={pending.toAddress} />
          </div>

          {!isSending && (
            <Button className="mt-4" onClick={() => sendToCoinbase(pending)}>
              Send {pending.amount} {pending.currency} to Coinbase
            </Button>
          )}
          {isSending && (
            <p className="mt-4 text-sm text-secondary-600 dark:text-secondary-300">
              Sending… gas is covered for you.
            </p>
          )}
        </div>
      ) : isWaitingForOrder ? (
        <p className="mt-6 text-sm text-secondary-600 dark:text-secondary-300">
          Checking your cash-out with Coinbase…
        </p>
      ) : (
        <div className="mt-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-200 mb-2">
              Token
            </label>
            <div className="flex flex-wrap gap-4">
              {supportedTokens.map(token => (
                <label
                  key={token.symbol}
                  className="flex items-center text-secondary-700 dark:text-secondary-200"
                >
                  <input
                    type="radio"
                    name="cashOutToken"
                    value={token.symbol}
                    checked={symbol === token.symbol}
                    onChange={e => setSymbol(e.target.value)}
                    className="mr-2"
                  />
                  {token.symbol}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor="cashOutAmount"
              className="block text-sm font-medium text-secondary-700 dark:text-secondary-200 mb-2"
            >
              Amount
            </label>
            <Input
              id="cashOutAmount"
              type="number"
              step="any"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              error={
                amount && !amountIsValid
                  ? 'Amount must be greater than 0 and not exceed your balance'
                  : undefined
              }
              helpText={`Available: ${balances[symbol] || '0.0000'} ${symbol}`}
            />
          </div>

          <Button onClick={handleStart} disabled={!canStart} className="w-full">
            {isOpening ? 'Opening Coinbase…' : `Cash out ${symbol}`}
          </Button>

          <p className="text-xs text-secondary-500 dark:text-secondary-400">
            Coinbase handles the payout and any ID checks. You come back here to approve the
            transfer — we cover the gas.
          </p>
        </div>
      )}

      {error && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {sentTxHash && (
        <div className="mt-4 rounded-md border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-4">
          <p className="text-sm text-green-700 dark:text-green-300">
            Sent to Coinbase. They will pay out to your bank once it confirms.
          </p>
          <div className="mt-1 text-sm text-green-700 dark:text-green-300">
            <ExpandableHash hash={sentTxHash} />
          </div>
        </div>
      )}
    </div>
  );
}
