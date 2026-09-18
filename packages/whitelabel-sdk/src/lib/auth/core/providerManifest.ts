import { AuthConfig, ProviderType } from '@/lib/auth/types';
import { UnifiedProvider } from '@/lib/auth/types/unified-provider';
import type { ComponentType } from 'react';

/**
 * Every wallet provider the app can use, as data.
 *
 * ⚠️ ADDING ONE IS AN ENTRY IN THIS ARRAY AND NOTHING ELSE. It used to be five edits — the
 *    `ProviderType` union, an `if` in `initialize()`, a `registerXProvider()` method, a branch
 *    in `getBestProvider()`, and the provider itself — with three of those scattered inside the
 *    registry's own logic. That is the difference between "swappable in principle" and
 *    somebody actually doing it.
 *
 * ⚠️ `load` IS A DYNAMIC IMPORT ON PURPOSE. Each provider pulls a wallet SDK behind it, and a
 *    static import would put every one of them in the bundle of a user who will only ever meet
 *    one. Reown alone is not small.
 */
export interface ProviderDescriptor {
  /** How this provider is asked for by name. */
  readonly type: ProviderType;

  /**
   * Whether this provider applies at all, given the config and the environment it is running
   * in. Returning false is ordinary — a Farcaster provider outside a frame, a provider whose
   * project id is unset — and not an error.
   */
  readonly applies: (config: AuthConfig) => boolean;

  /**
   * Which provider wins when several apply. HIGHER RUNS FIRST.
   *
   * ⚠️ Ties are not resolved and must not exist: two providers claiming the same number would
   *    be picked between by array order, which is invisible at the call site. The registry
   *    refuses a manifest containing one rather than choosing quietly.
   */
  readonly priority: number;

  /**
   * Whether failing to register this one should stop the app.
   *
   * Farcaster is optional — outside a frame there is simply nothing to connect to. A wallet
   * provider that cannot start when it is the only one that applies leaves a user with no way
   * to sign in at all, which is worth failing loudly for rather than discovering at the first
   * button press.
   */
  readonly required: boolean;

  /**
   * Whether, in this config, the provider is the LEGACY option rather than a contender.
   *
   * A legacy provider is not started at boot and never wins selection; it is loaded on demand
   * when a user asks for a wallet they made under it (`connect({ legacyWallet: true })`), so
   * that funds in an old embedded wallet stay reachable after the app moves to a new provider.
   * Omit for a provider that is never legacy.
   */
  readonly legacy?: (config: AuthConfig) => boolean;

  /** Imported only when it applies. */
  readonly load: (config: AuthConfig) => Promise<UnifiedProvider>;

  /**
   * A React subtree this provider needs mounted, for hooks-based SDKs. Rendered by
   * `ProviderHosts` beside the app, never around it. Omit for imperative SDKs like AppKit.
   */
  readonly host?: () => Promise<ComponentType<{ config: AuthConfig }>>;
}

export const PROVIDERS: readonly ProviderDescriptor[] = [
  {
    type: 'farcaster',
    // Inside a Farcaster frame the host wallet is the only one that can sign, so this wins
    // wherever it applies.
    applies: () => isInFarcaster(),
    priority: 100,
    required: false,
    load: async (config) => {
      const { FarcasterProvider } = await import('@/lib/auth/providers/FarcasterProvider');
      return new FarcasterProvider(config) as unknown as UnifiedProvider;
    },
  },
  {
    type: 'walletconnect',
    // Handles everything else: external wallets, email and social through AppKit's embedded
    // accounts. Without a project id there is nothing to connect with.
    //
    // ⚠️ LEGACY WHEN PRIVY IS CONFIGURED, rather than losing on priority. Both cover the same
    //    ground, and registering both at boot would construct AppKit — a singleton that cannot
    //    be torn down — for a user who will only ever see Privy's modal. But people who signed
    //    up under Reown have funds in Reown embedded wallets that only Reown can open, so it
    //    stays loadable on request: the sign-in card's "old wallet" tick box.
    applies: (config) => Boolean(config.walletConnectProjectId),
    legacy: (config) => Boolean(config.privyAppId),
    priority: 10,
    required: true,
    load: async (config) => {
      const { WalletConnectProvider } = await import('@/lib/auth/providers/WalletConnectProvider');
      return new WalletConnectProvider(config) as unknown as UnifiedProvider;
    },
  },
  {
    type: 'privy',
    // The switch. Set PRIVY_APP_ID and this applies, Reown stands down; unset it and nothing
    // here is loaded. Same ground as Reown — external wallets, email, social — so it outranks
    // it, and Farcaster still wins inside a frame.
    applies: (config) => Boolean(config.privyAppId),
    priority: 20,
    required: false,
    load: async (config) => {
      const { PrivyProvider } = await import('@/lib/auth/providers/PrivyProvider');
      return new PrivyProvider(config);
    },
    host: async () => (await import('@/lib/auth/providers/privy/PrivyHost')).default,
  },
];

/**
 * Whether we are running inside a Farcaster frame.
 *
 * Kept beside the descriptor that asks, rather than on the registry, so that the registry holds
 * no knowledge of any particular provider.
 */
export function isInFarcaster(): boolean {
  if (typeof window === 'undefined') return false;

  // ⚠️ MOVED VERBATIM FROM ProviderRegistry, not rewritten. Frame detection decides which
  //    wallet a user gets, and "tidying" it while relocating it would change who can sign in
  //    without anything in the diff looking like a behaviour change.
  return !!(
    window.parent !== window &&
    (window.navigator.userAgent.includes('farcaster') ||
      window.location !== window.parent.location)
  );
}
