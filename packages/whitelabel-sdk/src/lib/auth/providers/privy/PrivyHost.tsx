import React, { useEffect, useMemo } from 'react';
import { PrivyProvider, useDepositFunds, useLogin, useLogout, useModalStatus, usePrivy, useSendTransaction, useSignTypedData, useWallets } from '@privy-io/react-auth';
import type { ConnectedWallet, SignTypedDataParams, UnsignedTransactionRequest, User } from '@privy-io/react-auth';
import type { ethers } from 'ethers';

import { termsUrl } from '@/lib/auth/siwe-statement';
import { getWalletPrompt, walletSaysIt } from '@/lib/auth/walletPromptChannel';
import type { AuthConfig } from '@/lib/auth/types';
import { isInIframe } from '@/utils/deviceDetection';
import { depositFundsOptions, fundWalletResult } from './fundingRequest';
import { keepModalInView } from './keepModalInView';
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
  // ⚠️ ONLY A WALLET THAT BELONGS TO THE ACCOUNT SIGNED IN. Privy's list is every wallet connected
  //    to this BROWSER: a browser wallet stays in it after logout, and on a page load it is
  //    listed before the embedded wallet has loaded. Falling back to "whatever is first" named
  //    that leftover wallet as the user's (dev, 11 Nov 2026): the page read its balance and
  //    nonce, the embedded wallet signed, and the transaction could never confirm.
  //    While the account's own wallet has not loaded yet, there is no wallet: wait for it.
  const own = new Set(
    (user?.linkedAccounts ?? [])
      .filter((account) => account.type === 'wallet' || account.type === 'smart_wallet')
      .map((account) => (account as { address?: string }).address?.toLowerCase())
      .filter(Boolean)
  );
  const primary = user?.wallet?.address?.toLowerCase();
  if (primary) own.add(primary);
  const mine = wallets.filter((w) => own.has(w.address.toLowerCase()));
  if (mine.length === 0) return null;
  return (
    mine.find((w) => w.address.toLowerCase() === primary) ??
    mine.find((w) => w.walletClientType === 'privy') ??
    mine[0]
  );
}

/**
 * Sign out, and let go of any browser wallet first. Privy's logout ends the account's session
 * but leaves a browser wallet connected to the page, where the next account to sign in finds it.
 */
export async function logoutAndDisconnect(wallets: ConnectedWallet[], logout: () => Promise<void>): Promise<void> {
  for (const wallet of wallets) {
    if (wallet.walletClientType === 'privy') continue;
    try {
      wallet.disconnect();
    } catch {
      // Some wallets cannot be disconnected from the page's side; signing out still goes ahead.
    }
  }
  await logout();
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

/**
 * What Privy's signature prompt says under its title. Its default — "Signing this message will
 * not cost you any fees." — reads as if the payment itself were free, when what is free is the gas.
 */
export const SIGN_PROMPT_DESCRIPTION = "Signing this message won't cost you any gas fees.";

type SignTypedData = (
  input: SignTypedDataParams,
  options: { address: string; uiOptions: { description: string } }
) => Promise<{ signature: string }>;

/**
 * The embedded wallet's EIP-1193 provider, with `eth_signTypedData_v4` sent through Privy's own
 * `signTypedData` so its prompt carries SIGN_PROMPT_DESCRIPTION.
 *
 * ⚠️ HERE, NOT AT THE CALL SITE. Callers sign through ethers over the plain provider (the payment
 *    authorization in PayPage among them), and that route has no way to pass Privy UI options —
 *    it always shows Privy's default text. Every other request goes through untouched.
 */
export function withSignPrompt(
  provider: ethers.Eip1193Provider,
  signTypedData: SignTypedData,
  address: string
): ethers.Eip1193Provider {
  const request: ethers.Eip1193Provider['request'] = async (args) => {
    if (args.method !== 'eth_signTypedData_v4') return provider.request(args);
    // ethers sends [address, JSON]; some callers send the object itself.
    const [, data] = (args.params ?? []) as [string, string | SignTypedDataParams];
    const typed = typeof data === 'string' ? (JSON.parse(data) as SignTypedDataParams) : data;
    const { signature } = await signTypedData(typed, {
      address,
      uiOptions: { description: SIGN_PROMPT_DESCRIPTION }
    });
    return signature;
  };
  return new Proxy(provider, {
    get(target, prop, receiver) {
      if (prop === 'request') return request;
      const value = Reflect.get(target, prop, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    }
  });
}

type SendTransaction = (
  input: UnsignedTransactionRequest,
  options: { address: string; uiOptions: { description: string } }
) => Promise<{ hash: string }>;

/**
 * The embedded wallet's provider, with a transaction that carries its own description sent
 * through Privy's `sendTransaction`, so Privy's prompt says it. Left to itself Privy describes
 * an approval as "…would like your permission for 0x… to spend tokens on your behalf", which
 * names an address and neither how much nor why.
 *
 * ⚠️ ONLY A TRANSACTION THAT ASKS FOR IT. The description comes from the caller through
 *    walletPromptChannel (Web3Service puts it there for exactly as long as the wallet call is in
 *    flight). Everything else goes to the provider untouched, as it always has.
 */
export function withTransactionPrompt(
  provider: ethers.Eip1193Provider,
  sendTransaction: SendTransaction,
  address: string
): ethers.Eip1193Provider {
  const request: ethers.Eip1193Provider['request'] = async (args) => {
    if (args.method !== 'eth_sendTransaction') return provider.request(args);
    // ⚠️ NEVER SIGN FOR A DIFFERENT ADDRESS THAN THE ONE THE TRANSACTION WAS BUILT FOR. The nonce
    //    and the gas were worked out for `from`; signed by another wallet the transaction is
    //    accepted and then never confirms, and the page waits on it for minutes. Refused here,
    //    it fails at once and says so.
    const from = ((args.params ?? []) as Array<{ from?: string }>)[0]?.from;
    if (from && from.toLowerCase() !== address.toLowerCase()) {
      throw new Error('This page is out of step with your wallet. Nothing was sent. Reload the page and try again.');
    }
    const prompt = getWalletPrompt();
    const description = prompt?.kind === 'transaction' ? prompt.walletDescription : undefined;
    if (!description) return provider.request(args);
    // JSON-RPC calls the gas limit `gas`; Privy, like ethers, calls it `gasLimit`.
    const [{ gas, ...tx }] = (args.params ?? []) as [Record<string, unknown> & { gas?: string }];
    // Privy's screen is about to say it; our notice over the top would only repeat it.
    walletSaysIt();
    const { hash } = await sendTransaction({ ...tx, ...(gas ? { gasLimit: gas } : {}) } as UnsignedTransactionRequest, {
      address,
      uiOptions: { description }
    });
    return hash;
  };
  return new Proxy(provider, {
    get(target, prop, receiver) {
      if (prop === 'request') return request;
      const value = Reflect.get(target, prop, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    }
  });
}

function PrivyBridge({ config }: { config: AuthConfig }) {
  const { ready, authenticated, user, exportWallet } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const { login } = useLogin({
    onComplete: () => privyBridge.loginCompleted(),
    onError: (code) => privyBridge.loginFailed(String(code))
  });
  const { logout } = useLogout();
  const { isOpen: modalOpen } = useModalStatus();
  const { depositFunds } = useDepositFunds();
  const { signTypedData } = useSignTypedData();
  const { sendTransaction } = useSendTransaction();
  // Memoised: a fresh chain object every render would re-register the API every render.
  const chain = useMemo(() => chainFromConfig(config), [config.chainId, config.rpcUrl, config.explorerBaseUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const active = pickWallet(user, wallets);
  const activeAddress = active?.address ?? null;

  useEffect(() => {
    privyBridge.registerApi({
      login: (options) => login({ loginMethods: [...options.loginMethods] }),
      logout: () => logoutAndDisconnect(wallets, logout),
      getEthereumProvider: async () => {
        if (!active) return null;
        const provider = await active.getEthereumProvider();
        // Only Privy's own wallet shows Privy's prompt; an external wallet shows its own.
        return active.walletClientType === 'privy'
          ? withTransactionPrompt(withSignPrompt(provider, signTypedData, active.address), sendTransaction, active.address)
          : provider;
      },
      switchChain: async (chainId) => {
        if (active) await active.switchChain(chainId);
      },
      // Not useFundWallet, which Privy deprecated and which does not surface its Stripe onramp.
      fundWallet: (address, request) =>
        fundWalletResult(depositFunds(depositFundsOptions(address, request, chain.id))),
      exportWallet: (address) => exportWallet({ address })
    });
    return () => privyBridge.registerApi(null);
  }, [login, logout, wallets, active, depositFunds, exportWallet, chain, signTypedData, sendTransaction]);

  // In a partner's frame Privy's modal can open in a part of the frame that is scrolled out of
  // sight. Only there: on our own site the frame's viewport is the window.
  useEffect(() => {
    if (!modalOpen || !isInIframe()) return;
    return keepModalInView();
  }, [modalOpen]);

  useEffect(() => {
    privyBridge.publish({
      ready: ready && walletsReady,
      authenticated,
      address: activeAddress,
      embedded: active?.walletClientType === 'privy',
      modalOpen,
      user: userInfoFrom(user)
    });
  }, [ready, walletsReady, authenticated, activeAddress, active?.walletClientType, modalOpen, user]);

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
        // Linked from the modal's footer. The signature that follows login is what accepts them.
        legal: { termsAndConditionsUrl: termsUrl(config.serviceLink) },
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
