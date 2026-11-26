import type { FundingRoute } from './reportFundingEvent';
import { fundingContract } from './fundingContract';

/** A way of buying the buyer opened: how it is logged, what it is called on screen, where it delivers. */
export interface OpenedProvider {
  /** The name it is logged under (Privy, Coinbase, MoonPay). */
  logged: string;
  /** Its name as the buyer reads it. Absent for the wallet provider's own card window. */
  name?: string;
  route: FundingRoute;
}

/**
 * A note, kept in this browser, that a way of buying was opened for a payment and has not been
 * heard from since. The page reads it when it loads: on a phone the page is often reloaded (or
 * the link reopened) while the buyer is away buying, and then nothing in the page knows a
 * purchase was ever tried. With the note, it can ask how it went (FundingTrouble, "returned").
 *
 * Per wallet and per payment, and only for two hours: after that it says nothing about now.
 * Storage that is missing or refuses (private windows, a partner's frame) just means no note.
 */
const LASTS_MS = 2 * 60 * 60 * 1000;

const key = (wallet: string) =>
  `sd.purchaseOpened.${wallet.toLowerCase()}.${fundingContract() ?? ''}`;

/** `held`: how much was already where the purchase delivers, so a later look can tell what arrived. */
export function markPurchaseOpened(wallet: string, provider: OpenedProvider, held?: number, now = Date.now()): void {
  try {
    const { logged, name, route } = provider;
    window.localStorage.setItem(key(wallet), JSON.stringify({ at: now, logged, name, route, held }));
  } catch {
    // No note.
  }
}

export function forgetPurchaseOpened(wallet: string): void {
  try {
    window.localStorage.removeItem(key(wallet));
  } catch {
    // Nothing to forget.
  }
}

/** The way of buying opened here recently that never reported back, if any. Reading it clears it. */
export function takePurchaseLeftOpen(wallet: string, now = Date.now()): { provider: OpenedProvider; held?: number } | null {
  try {
    const raw = window.localStorage.getItem(key(wallet));
    window.localStorage.removeItem(key(wallet));
    const note = raw ? (JSON.parse(raw) as Partial<OpenedProvider> & { at?: number; held?: number }) : null;
    if (!note || typeof note.at !== 'number' || now - note.at < 0 || now - note.at >= LASTS_MS) return null;
    if (typeof note.logged !== 'string' || (note.route !== 'wallet' && note.route !== 'payment')) return null;
    return {
      provider: { logged: note.logged, name: typeof note.name === 'string' ? note.name : undefined, route: note.route },
      held: typeof note.held === 'number' ? note.held : undefined,
    };
  } catch {
    return null;
  }
}
