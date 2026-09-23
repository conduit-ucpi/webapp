import type { ethers } from 'ethers';
import type { FundWalletRequest, FundWalletResult } from '@/lib/auth/types/unified-provider';

/**
 * The seam between Privy's React hooks and the imperative `PrivyProvider` class.
 *
 * Privy only exposes state through hooks that must run under `<PrivyProvider>`. `UnifiedProvider`
 * is a class the manifest instantiates outside React. This module is the store that joins them:
 * the host component publishes hook state INTO it and registers the few actions the class needs;
 * the class reads and waits on it.
 *
 * ⚠️ IMPORTS NOTHING FROM PRIVY, deliberately. That is what makes the provider class testable
 *    with a fake host, and it is what keeps `@privy-io/*` confined to one file
 *    (privy-chokepoint.test.ts).
 */

export interface PrivyUserInfo {
  email?: string;
  name?: string;
  authProvider?: string;
}

export interface PrivySnapshot {
  /** Privy and its wallet list have both finished initialising (including session restore). */
  ready: boolean;
  authenticated: boolean;
  /** The active wallet's address, or null when there is none yet. */
  address: string | null;
  /** Whether the active wallet is a Privy embedded wallet (exportable), not an external one. */
  embedded: boolean;
  user: PrivyUserInfo | null;
}

export type PrivyLoginMethod = 'wallet' | 'email' | 'google' | 'apple';

export interface PrivyBridgeApi {
  /** Opens Privy's login modal. The outcome arrives through `loginCompleted` / `loginFailed`. */
  login(options: { loginMethods: readonly PrivyLoginMethod[] }): void;
  logout(): Promise<void>;
  /** The active wallet's EIP-1193 provider, or null when there is no active wallet. */
  getEthereumProvider(): Promise<ethers.Eip1193Provider | null>;
  switchChain(chainId: number): Promise<void>;
  /** Privy's funding modal for `address`. Resolves when the user finishes or leaves it. */
  fundWallet(address: string, request: FundWalletRequest): Promise<FundWalletResult>;
  /** Privy's export modal for `address` — the key is shown in Privy's iframe, never to us. */
  exportWallet(address: string): Promise<void>;
}

export type LoginOutcome = { ok: true } | { ok: false; code: string };

type Listener = (snapshot: PrivySnapshot) => void;

const EMPTY: PrivySnapshot = { ready: false, authenticated: false, address: null, embedded: false, user: null };

let snapshot: PrivySnapshot = EMPTY;
let api: PrivyBridgeApi | null = null;
const listeners = new Set<Listener>();
let pendingLogin: ((outcome: LoginOutcome) => void) | null = null;

export const privyBridge = {
  getSnapshot(): PrivySnapshot {
    return snapshot;
  },

  getApi(): PrivyBridgeApi | null {
    return api;
  },

  registerApi(next: PrivyBridgeApi | null): void {
    api = next;
  },

  /** Called by the host on every relevant render. Only notifies when something changed. */
  publish(next: PrivySnapshot): void {
    const changed =
      next.ready !== snapshot.ready ||
      next.authenticated !== snapshot.authenticated ||
      next.address !== snapshot.address ||
      next.embedded !== snapshot.embedded ||
      next.user?.email !== snapshot.user?.email ||
      next.user?.name !== snapshot.user?.name ||
      next.user?.authProvider !== snapshot.user?.authProvider;
    if (!changed) return;
    snapshot = next;
    listeners.forEach((listener) => listener(snapshot));
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  /**
   * Resolves when the snapshot satisfies `predicate`, or rejects after `timeoutMs`.
   *
   * ⚠️ A TIMEOUT, NOT A HANG. Privy's embedded wallet can appear a tick after login completes,
   *    and a session restore on cold load takes a moment — both are worth waiting for. A host
   *    that never mounted (no `PRIVY_APP_ID`, host not rendered) is not, and without the
   *    timeout the connect button would spin forever with nothing in the logs.
   */
  waitFor(predicate: (s: PrivySnapshot) => boolean, timeoutMs: number, what: string): Promise<PrivySnapshot> {
    if (predicate(snapshot)) return Promise.resolve(snapshot);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        unsubscribe();
        // Say which half is missing. "host never registered" is our wiring (ProviderHosts did
        // not mount PrivyHost); "host registered, Privy not ready" is Privy failing to
        // initialise — app id, allowed origins — and the browser console will have its warning.
        const s = snapshot;
        const diagnosis = api
          ? `host registered; ready=${s.ready} authenticated=${s.authenticated} address=${s.address ?? 'none'}`
          : 'host never registered (PrivyHost not mounted, or ProviderHosts did not render it)';
        reject(new Error(`Privy: timed out after ${timeoutMs}ms waiting for ${what} — ${diagnosis}`));
      }, timeoutMs);
      const unsubscribe = privyBridge.subscribe((s) => {
        if (!predicate(s)) return;
        clearTimeout(timer);
        unsubscribe();
        resolve(s);
      });
    });
  },

  /** The class calls this BEFORE opening the modal, so the outcome cannot be missed. */
  nextLoginOutcome(): Promise<LoginOutcome> {
    return new Promise((resolve) => {
      pendingLogin = resolve;
    });
  },

  loginCompleted(): void {
    pendingLogin?.({ ok: true });
    pendingLogin = null;
  },

  loginFailed(code: string): void {
    pendingLogin?.({ ok: false, code });
    pendingLogin = null;
  },

  /** Test hook. */
  _reset(): void {
    snapshot = EMPTY;
    api = null;
    listeners.clear();
    pendingLogin = null;
  }
};
