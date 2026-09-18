import React, { useEffect, useMemo } from 'react';
import { PrivyProvider, useFundWallet, useLogin, useLogout, usePrivy, useWallets } from '@privy-io/react-auth';
import type { ConnectedWallet, User } from '@privy-io/react-auth';

import type { AuthConfig } from '@/lib/auth/types';
import { privyBridge, type PrivyUserInfo } from './privyBridge';

/**
 * The React subtree Privy needs, and THE ONLY FILE THAT IMPORTS `@privy-io/*`.
 *
 * Rendered by `ProviderHosts` as a sibling of the app tree, never around it: the app uses no
 * Privy hooks, only `PrivyBridge` below does, so nothing remounts when this appears. Privy's
 * modal is a portal and works from here.
 *
 * ⚠️ `loginMethods` ARE NOT SET HERE. They go in at `login()` time from the provider class,
 *    which is what lets `setConnectionMode` (wallet-only / social-only) work without changing
 *    this component's props and re-initialising Privy.
 */

type PrivyConfig = NonNullable<React.ComponentProps<typeof PrivyProvider>['config']>;
type PrivyChain = NonNullable<PrivyConfig['defaultChain']>;

const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum',
  8453: 'Base',
  11155111: 'Sepolia',
  84532: 'Base Sepolia'
};

/**
 * The chain Privy should default its embedded wallets to — the app's, from config.
 *
 * Built rather than imported from `viem/chains` so there is no second table of chain ids to
 * keep in step with `CHAIN_ID`, and no direct dependency on viem.
 */
export function chainFromConfig(config: AuthConfig): PrivyChain {
  return {
    id: config.chainId,
    name: CHAIN_NAMES[config.chainId] ?? `Chain ${config.chainId}`,
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [config.rpcUrl] } },
    blockExplorers: { default: { name: 'Explorer', url: config.explorerBaseUrl } }
  } as PrivyChain;
}

/**
 * Which of Privy's connected wallets is "the" wallet.
 *
 * `user.wallet` is what Privy itself calls the primary — the embedded wallet after an
 * email/social login, the external wallet after a wallet login. Fall back to an embedded
 * wallet, then to whatever is first.
 */
export function pickWallet(user: User | null, wallets: ConnectedWallet[]): ConnectedWallet | null {
  if (wallets.length === 0) return null;
  const primary = user?.wallet?.address?.toLowerCase();
  return (
    wallets.find((w) => w.address.toLowerCase() === primary) ??
    wallets.find((w) => w.walletClientType === 'privy') ??
    wallets[0]
  );
}

/**
 * What Privy verified about the person, in the shape `getUserInfo()` has always returned.
 *
 * Null for a plain wallet login, matching the Reown adapter: an external wallet tells us
 * nothing about an email, and inventing a field would be worse than omitting it.
 */
export function userInfoFrom(user: User | null): PrivyUserInfo | null {
  if (!user) return null;
  const email = user.email?.address ?? user.google?.email ?? user.apple?.email ?? undefined;
  const name = user.google?.name ?? undefined;
  const authProvider = user.google ? 'google' : user.apple ? 'apple' : user.email ? 'email' : undefined;
  if (!email && !name) return null;
  return { email, name, authProvider };
}

function PrivyBridge({ config }: { config: AuthConfig }) {
  const { ready, authenticated, user, exportWallet } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const { login } = useLogin({
    onComplete: () => privyBridge.loginCompleted(),
    onError: (code) => privyBridge.loginFailed(String(code))
  });
  const { logout } = useLogout();
  const { fundWallet } = useFundWallet();
  // Memoised: a fresh chain object every render would re-register the API every render.
  const chain = useMemo(() => chainFromConfig(config), [config.chainId, config.rpcUrl, config.explorerBaseUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const active = pickWallet(user, wallets);
  const activeAddress = active?.address ?? null;

  useEffect(() => {
    privyBridge.registerApi({
      login: (options) => login({ loginMethods: [...options.loginMethods] }),
      logout,
      getEthereumProvider: async () => (active ? active.getEthereumProvider() : null),
      switchChain: async (chainId) => {
        if (active) await active.switchChain(chainId);
      },
      // The request names the app's chain by id; Privy wants the chain object, which we build
      // from config rather than import, so the id must agree with it.
      fundWallet: async (address, request) => {
        // Privy types the erc20 address as `0x${string}`; ours is a plain string from config.
        const asset =
          typeof request.asset === 'object' ? { erc20: request.asset.erc20 as `0x${string}` } : request.asset;
        const result = await fundWallet({
          address,
          options: { chain, asset, amount: request.amount }
        });
        return { status: result.status, transactionHash: result.transactionHash };
      },
      exportWallet: (address) => exportWallet({ address })
    });
    return () => privyBridge.registerApi(null);
  }, [login, logout, active, fundWallet, exportWallet, chain]);

  useEffect(() => {
    privyBridge.publish({
      ready: ready && walletsReady,
      authenticated,
      address: activeAddress,
      embedded: active?.walletClientType === 'privy',
      user: userInfoFrom(user)
    });
  }, [ready, walletsReady, authenticated, activeAddress, active?.walletClientType, user]);

  return null;
}

export default function PrivyHost({ config }: { config: AuthConfig }) {
  if (!config.privyAppId) return null;
  const chain = chainFromConfig(config);

  return (
    <PrivyProvider
      appId={config.privyAppId}
      config={{
        appearance: { walletChainType: 'ethereum-only' },
        // An embedded wallet for anyone who arrives without one — the email/social users. A
        // wallet login already has a wallet and gets none.
        embeddedWallets: { ethereum: { createOnLogin: 'users-without-wallets' } },
        defaultChain: chain,
        supportedChains: [chain],
        // Privy reaches external wallets over WalletConnect too; reuse our project.
        walletConnectCloudProjectId: config.walletConnectProjectId
      }}
    >
      <PrivyBridge config={config} />
    </PrivyProvider>
  );
}
