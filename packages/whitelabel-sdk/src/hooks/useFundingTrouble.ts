import { useCallback, useEffect, useRef, useState } from 'react';
import { forgetPurchaseOpened, markPurchaseOpened, takePurchaseLeftOpen, type OpenedProvider } from '@/lib/purchaseMarker';

/**
 * How the buyer came to need help:
 *   cancelled  they closed the card window without buying
 *   failed     the card window reported a problem
 *   short      a purchase arrived, and it is not enough (the company's fee came out of it)
 *   returned   they are back from a company's own page (or the page was reloaded while one was
 *              open), nothing has arrived that the page can see, and how it went is not known
 *   stuck      a purchase said to be on its way has not arrived after five minutes
 */
export type TroubleKind = 'cancelled' | 'failed' | 'short' | 'returned' | 'stuck';

/** The way of buying it happened with, and how to open it again when the page knows how. */
export interface TroubledProvider extends OpenedProvider {
  reopen?: () => void;
}

/**
 * What is where the purchase delivers, in whole tokens, and what the payment needs of it. No
 * `needed` on a screen with no payment (/wallet): there, more than before is simply "it arrived".
 */
export interface Seen {
  held: number;
  needed?: number;
}

export interface FundingTroubleState {
  kind: TroubleKind;
  provider: TroubledProvider;
  /** What the page saw when it looked, where it could look: always there for 'short'. */
  seen?: Seen;
}

/**
 * Looks, now, at where this way of buying delivers (the wallet, or the payment's own address).
 * Null when it cannot be read, or cannot be read yet.
 */
export type LookForPurchase = (provider: OpenedProvider) => Promise<Seen | null>;

/** Back sooner than this and they did not try to buy: a wrong press, or a blocked window. */
const AWAY_AT_LEAST_MS = 5_000;
/** A moment for the company's own page to say it finished (Coinbase does) before anything is done. */
const ASK_AFTER_MS = 1_000;
/** How long a purchase said to be on its way may show nothing before the page says so. */
export const STUCK_AFTER_MS = 5 * 60_000;
/** A page just loaded may not be able to look yet (no wallet, no payment): tried this often, this far apart. */
const LOOK_TRIES_ON_LOAD = 5;
const LOOK_AGAIN_MS = 2_000;
/** Less than this is not a purchase arriving. */
const DUST = 0.005;

/**
 * What went wrong with buying stablecoins, for EVERY way of buying, and the one place it is worked
 * out. It lives inside useWalletFunding, so each screen that offers ways of buying has it, and the
 * screen draws it with <FundingTrouble>.
 *
 * Only the wallet provider's card window tells the page how a purchase ended. Every other way is
 * a company's own page in another tab or window, which tells us nothing. So:
 *   - the card window: `cardEnded` with its answer; a cancel or a failure is trouble at once;
 *   - anything else: `opened`, and when the buyer comes back to this page the page LOOKS FIRST
 *     (`look`) at where the purchase delivers, and only then decides what to say:
 *       it is all there          nothing: there is no trouble, and the screen moves on by itself;
 *       more is there, not enough  'short', with the figures: buy the rest;
 *       nothing new is there     'returned': we looked and cannot see it yet; how did it go?
 *     (with no payment to measure against, more than before is "all there")
 *     Coinbase's window says when it finished (`reportedBack`): the same look, but a purchase not
 *     yet arrived is waited for, not asked about;
 *   - either: a note is left in the browser (lib/purchaseMarker) so a page reloaded meanwhile looks too;
 *   - a purchase said to be on its way (`awaitArrival`) and not here in five minutes is 'stuck',
 *     where the screen can say whether the money has arrived (`funded`).
 *
 * ⚠️ LOOK BEFORE ASKING. First built (2026-11-26) to ask "did your purchase go through?" of everyone
 *    coming back, including those whose money was already sitting there. A buyer who has just paid
 *    should not be offered help with paying. A screen that cannot look (no `look`) still asks.
 *
 * `funded`: the money is known to be in the wallet, which ends all of it. Leave it undefined on a
 * screen that cannot tell; nothing is ever 'stuck' there.
 */
export function useFundingTrouble({
  walletAddress,
  off = false,
  funded,
  look,
}: {
  walletAddress: string;
  off?: boolean;
  funded?: boolean;
  look?: LookForPurchase;
}) {
  const [current, setCurrent] = useState<FundingTroubleState | null>(null);
  /** Opened in another tab or window: looked for when the buyer is back. */
  const [asking, setAsking] = useState<TroubledProvider | null>(null);
  /** Said to be on its way: the five minutes are running. */
  const [awaiting, setAwaiting] = useState<TroubledProvider | null>(null);
  const last = useRef<TroubledProvider | null>(null);
  /** What was there when the last one was opened, to tell what has arrived since. */
  const heldAtOpen = useRef<number | undefined>(undefined);
  /** Goes up whenever what is being worked out is no longer wanted: a newer open, the money arriving. */
  const turn = useRef(0);
  const lookRef = useRef(look);
  lookRef.current = look;

  /**
   * Looks at where the purchase delivers and says what that means. `said`: the company itself
   * said the purchase was made, so one not arrived yet is waited for. `onLoad`: the page has
   * only just loaded and may not be able to look for a moment.
   */
  const judge = useCallback(async (provider: TroubledProvider, before: number | undefined, how: { said?: boolean; onLoad?: boolean } = {}) => {
    const mine = ++turn.current;
    let seen: Seen | null = null;
    for (let tries = how.onLoad ? LOOK_TRIES_ON_LOAD : 1; tries > 0 && lookRef.current; tries--) {
      seen = await lookRef.current(provider).catch(() => null);
      if (seen || tries === 1) break;
      await new Promise((resolve) => window.setTimeout(resolve, LOOK_AGAIN_MS));
      if (mine !== turn.current) return;
    }
    if (mine !== turn.current) return;
    if (seen && seen.needed !== undefined && seen.needed > 0 && seen.held >= seen.needed - 1e-6) {
      // All there: the screen's own reading of it takes the buyer on.
      setCurrent(null);
      return;
    }
    // More than was there when it was opened; with nothing to compare against, anything at a
    // payment's own address, which holds nothing until somebody pays it.
    const arrived = seen ? (before !== undefined ? seen.held - before : provider.route === 'payment' ? seen.held : 0) : 0;
    // With nothing it has to add up to, something arriving is the purchase arriving.
    if (seen && arrived >= DUST) setCurrent(seen.needed === undefined ? null : { kind: 'short', provider, seen });
    else if (how.said) {
      setCurrent(null);
      if (provider.route === 'wallet') setAwaiting(provider);
    } else setCurrent({ kind: 'returned', provider, seen: seen ?? undefined });
  }, []);

  /** A way of buying was opened. `inPage`: it reports back itself (the card window), so nothing is looked for. */
  const opened = useCallback(
    ({ inPage = false, ...provider }: TroubledProvider & { inPage?: boolean }) => {
      if (off) return;
      const mine = ++turn.current;
      last.current = provider;
      heldAtOpen.current = undefined;
      setCurrent(null);
      setAwaiting(null);
      setAsking(inPage ? null : provider);
      markPurchaseOpened(walletAddress, provider);
      if (inPage) return;
      // What is there already, so that what arrives can be told from it. Not waited for.
      void lookRef
        .current?.(provider)
        .then((seen) => {
          if (!seen || mine !== turn.current) return;
          heldAtOpen.current = seen.held;
          markPurchaseOpened(walletAddress, provider, seen.held);
        })
        .catch(() => undefined);
    },
    [off, walletAddress]
  );

  /** It could not be opened after all: nothing was tried. */
  const notOpened = useCallback(() => {
    turn.current += 1;
    setAsking(null);
    forgetPurchaseOpened(walletAddress);
  }, [walletAddress]);

  /** How the card window ended. */
  const cardEnded = useCallback(
    (status: 'completed' | 'processing' | 'cancelled' | 'failed') => {
      const provider = last.current;
      forgetPurchaseOpened(walletAddress);
      if (!provider) return;
      if (status === 'cancelled' || status === 'failed') setCurrent({ kind: status, provider });
      else setCurrent(null);
      if (status === 'processing') setAwaiting(provider);
    },
    [walletAddress]
  );

  /** The company's own page said the purchase was made: looked for, and waited for if not here yet. */
  const reportedBack = useCallback(() => {
    forgetPurchaseOpened(walletAddress);
    setAsking(null);
    if (last.current) void judge(last.current, heldAtOpen.current, { said: true });
  }, [walletAddress, judge]);

  /** The buyer says the purchase went through: into a wallet, the five minutes start. */
  const awaitArrival = useCallback((provider: TroubledProvider) => {
    if (provider.route === 'wallet') setAwaiting(provider);
  }, []);

  const close = useCallback(() => setCurrent(null), []);

  // Back from the company's page: look for the purchase, and ask only if it is not there.
  useEffect(() => {
    if (!asking) return;
    // Opening it is leaving: the tab or window is in front from that moment.
    let leftAt: number | null = Date.now();
    let timer: number | undefined;
    const away = () => {
      window.clearTimeout(timer);
      if (leftAt === null) leftAt = Date.now();
    };
    const back = () => {
      if (document.visibilityState !== 'visible') return;
      const gone = leftAt === null ? 0 : Date.now() - leftAt;
      leftAt = null;
      if (gone < AWAY_AT_LEAST_MS) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        forgetPurchaseOpened(walletAddress);
        setAsking(null);
        void judge(asking, heldAtOpen.current);
      }, ASK_AFTER_MS);
    };
    const seen = () => (document.visibilityState === 'visible' ? back() : away());
    window.addEventListener('blur', away);
    window.addEventListener('focus', back);
    document.addEventListener('visibilitychange', seen);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('blur', away);
      window.removeEventListener('focus', back);
      document.removeEventListener('visibilitychange', seen);
    };
  }, [asking, walletAddress, judge]);

  // On its way for five minutes and not here.
  useEffect(() => {
    if (!awaiting || funded !== false) return;
    const timer = window.setTimeout(() => setCurrent({ kind: 'stuck', provider: awaiting }), STUCK_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [awaiting, funded]);

  // The money is here: nothing is wrong any more.
  useEffect(() => {
    if (!funded) return;
    turn.current += 1;
    setCurrent(null);
    setAsking(null);
    setAwaiting(null);
    forgetPurchaseOpened(walletAddress);
  }, [funded, walletAddress]);

  // A page loaded while a way of buying was open (a phone reloading it, or the link reopened).
  useEffect(() => {
    if (off || !walletAddress) return;
    const left = takePurchaseLeftOpen(walletAddress);
    if (!left) return;
    last.current = left.provider;
    heldAtOpen.current = left.held;
    void judge(left.provider, left.held, { onLoad: true });
  }, [off, walletAddress, judge]);

  return { current: off ? null : current, opened, notOpened, cardEnded, reportedBack, awaitArrival, close };
}

export type FundingTroubleApi = ReturnType<typeof useFundingTrouble>;
